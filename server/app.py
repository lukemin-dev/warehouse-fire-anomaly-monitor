from flask import Flask, request
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
import json
import sqlite3
import os
import threading

app = Flask(__name__)
DB_PATH = os.path.expanduser(os.getenv('FIRE_DB_PATH', '~/warehouse-server/sensor.db'))

# ── AI 관련 ────────────────────────────────────────────────────────
MODEL_READY    = False
MIN_TRAIN_ROWS = 10
model          = None
LAST_ALERT_TS  = { 'gas': 0, 'flame': 0, 'ai': 0 }  # 각각 독립 쿨다운
ALERT_COOLDOWN = 10  # 초

# 학습 완료 전 초기 임계값 (첫 학습 후 자동 갱신됨)
MQ2_AO_THRESHOLD   = 300
FLAME_AO_THRESHOLD = 500

TRAIN_STATS = {
    "mq2_mean": 0, "mq2_std": 0, "mq2_threshold": 300,
    "flame_mean": 0, "flame_std": 0, "flame_threshold": 500,
}

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS readings (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ts          TEXT NOT NULL,
                mq2_ao      INTEGER DEFAULT 0,
                flame_ao    INTEGER DEFAULT 0,
                received_at TEXT,
                anomaly     INTEGER DEFAULT 0
            )
        ''')
        conn.execute('''
            CREATE TABLE IF NOT EXISTS alerts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ts          TEXT NOT NULL,
                type        TEXT NOT NULL,
                mq2_ao      INTEGER DEFAULT 0,
                flame_ao    INTEGER DEFAULT 0,
                ai_anomaly  INTEGER DEFAULT 0,
                resolved_at TEXT
            )
        ''')

init_db()

# ── 피처 추출 ──────────────────────────────────────────────────────
def extract_features(conn, mq2_ao: int, flame_ao: int) -> list[float]:
    rows = conn.execute(
        'SELECT mq2_ao, flame_ao FROM readings ORDER BY id DESC LIMIT 10'
    ).fetchall()

    if rows:
        mq2_vals   = [r['mq2_ao']   for r in rows]
        flame_vals = [r['flame_ao'] for r in rows]
        mq2_avg    = sum(mq2_vals)   / len(mq2_vals)
        flame_avg  = sum(flame_vals) / len(flame_vals)
        mq2_max    = max(mq2_vals)
        flame_max  = max(flame_vals)
    else:
        mq2_avg = flame_avg = mq2_max = flame_max = 0

    return [mq2_ao, flame_ao, mq2_avg, flame_avg, mq2_max, flame_max]

# ── 모델 학습 ──────────────────────────────────────────────────────
def train_model():
    global model, MODEL_READY, MQ2_AO_THRESHOLD, FLAME_AO_THRESHOLD, TRAIN_STATS
    try:
        from sklearn.ensemble import IsolationForest
        import numpy as np

        # 정상 구간 데이터만 사용 (현재 임계값 기준으로 필터)
        with get_db() as conn:
            all_rows = conn.execute(
                f"SELECT mq2_ao, flame_ao FROM readings WHERE mq2_ao < {MQ2_AO_THRESHOLD} ORDER BY id DESC LIMIT 10"
            ).fetchall()

        if len(all_rows) < MIN_TRAIN_ROWS:
            print(f"[AI] 학습 데이터 부족 ({len(all_rows)}/{MIN_TRAIN_ROWS})")
            return

        features = []
        for i, r in enumerate(all_rows):
            history = all_rows[i+1:i+11]
            if history:
                mq2_vals   = [h['mq2_ao']   for h in history]
                flame_vals = [h['flame_ao'] for h in history]
                mq2_avg    = sum(mq2_vals)   / len(mq2_vals)
                flame_avg  = sum(flame_vals) / len(flame_vals)
                mq2_max    = max(mq2_vals)
                flame_max  = max(flame_vals)
            else:
                mq2_avg = flame_avg = mq2_max = flame_max = 0
            features.append([r['mq2_ao'], r['flame_ao'], mq2_avg, flame_avg, mq2_max, flame_max])

        X = np.array(features)
        model = IsolationForest(contamination=0.01, random_state=42)
        model.fit(X)

        # 임계값 자동 계산 (평균 + 2σ)
        mq2_vals   = [r['mq2_ao']   for r in all_rows]
        flame_vals = [r['flame_ao'] for r in all_rows]

        mq2_mean   = float(np.mean(mq2_vals))
        mq2_std    = float(np.std(mq2_vals))
        flame_mean = float(np.mean(flame_vals))
        flame_std  = float(np.std(flame_vals))

        MIN_MARGIN = 10
        MQ2_AO_THRESHOLD   = int(mq2_mean  + max(2 * mq2_std,   MIN_MARGIN))
        FLAME_AO_THRESHOLD = int(flame_mean - max(2 * flame_std, MIN_MARGIN))

        TRAIN_STATS = {
            "mq2_mean":        round(mq2_mean, 1),
            "mq2_std":         round(mq2_std,  1),
            "mq2_threshold":   MQ2_AO_THRESHOLD,
            "flame_mean":      round(flame_mean, 1),
            "flame_std":       round(flame_std,  1),
            "flame_threshold": FLAME_AO_THRESHOLD,
            "min_margin":      MIN_MARGIN,
        }

        MODEL_READY = True
        print(f"[AI] 학습 완료 | MQ2 임계값={MQ2_AO_THRESHOLD} (평균{mq2_mean:.1f}+max(2σ={mq2_std:.1f},{MIN_MARGIN})) | 불꽃 임계값={FLAME_AO_THRESHOLD}")
    except Exception as e:
        print(f"[AI] 학습 오류: {e}")

def predict_anomaly(features: list[float]) -> bool:
    if not MODEL_READY or model is None:
        return False
    import numpy as np
    result = model.predict([features])
    return result[0] == -1

# ── API ────────────────────────────────────────────────────────────
@app.route('/api/event', methods=['POST'])
def receive_event():
    global LAST_ALERT_TS
    import time
    data        = request.get_json()
    received_at = datetime.now(KST).strftime('%Y-%m-%d %H:%M:%S')

    mq2_ao   = data.get('mq2_ao',   0)
    flame_ao = data.get('flame_ao', 0)

    with get_db() as conn:
        features   = extract_features(conn, mq2_ao, flame_ao)
        is_anomaly = predict_anomaly(features)

        # 학습된 임계값 초과도 이상치로 처리
        mq2_triggered   = MODEL_READY and mq2_ao   >= MQ2_AO_THRESHOLD
        flame_triggered = MODEL_READY and flame_ao <= FLAME_AO_THRESHOLD
        if mq2_triggered or flame_triggered:
            is_anomaly = True

        conn.execute('''
            INSERT INTO readings (ts, mq2_ao, flame_ao, received_at, anomaly)
            VALUES (?, ?, ?, ?, ?)
        ''', (data['ts'], mq2_ao, flame_ao, received_at, 1 if is_anomaly else 0))

        # 가스/불꽃 각각 독립 쿨다운 적용
        now = time.time()
        if mq2_triggered and (now - LAST_ALERT_TS['gas']) >= ALERT_COOLDOWN:
            conn.execute('''
                INSERT INTO alerts (ts, type, mq2_ao, flame_ao, ai_anomaly)
                VALUES (?, ?, ?, ?, ?)
            ''', (data['ts'], 'ANOMALY_GAS', mq2_ao, flame_ao, 1))
            LAST_ALERT_TS['gas'] = now

        if flame_triggered and (now - LAST_ALERT_TS['flame']) >= ALERT_COOLDOWN:
            conn.execute('''
                INSERT INTO alerts (ts, type, mq2_ao, flame_ao, ai_anomaly)
                VALUES (?, ?, ?, ?, ?)
            ''', (data['ts'], 'ANOMALY_FLAME', mq2_ao, flame_ao, 1))
            LAST_ALERT_TS['flame'] = now

        # 둘 다 아닌데 AI만 이상 감지한 경우
        if is_anomaly and not mq2_triggered and not flame_triggered:
            if (now - LAST_ALERT_TS['ai']) >= ALERT_COOLDOWN:
                conn.execute('''
                    INSERT INTO alerts (ts, type, mq2_ao, flame_ao, ai_anomaly)
                    VALUES (?, ?, ?, ?, ?)
                ''', (data['ts'], 'ANOMALY', mq2_ao, flame_ao, 1))
                LAST_ALERT_TS['ai'] = now

    status = 'anomaly' if is_anomaly else 'ok'
    print(f"[수신] MQ2_AO={mq2_ao} / 불꽃_AO={flame_ao} | AI={'이상' if is_anomaly else '정상'}")
    return json.dumps({"status": status, "threshold_mq2": MQ2_AO_THRESHOLD, "threshold_flame": FLAME_AO_THRESHOLD}, ensure_ascii=False), 200

@app.route('/api/readings', methods=['GET'])
def get_readings():
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM readings ORDER BY id DESC LIMIT 100'
        ).fetchall()
    return _json_response([dict(r) for r in rows])

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM alerts ORDER BY id DESC LIMIT 50'
        ).fetchall()
    return _json_response([dict(r) for r in rows])

@app.route('/api/latest', methods=['GET'])
def get_latest():
    with get_db() as conn:
        row = conn.execute(
            'SELECT * FROM readings ORDER BY id DESC LIMIT 1'
        ).fetchone()
    return _json_response(dict(row) if row else {})

@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    with get_db() as conn:
        count         = conn.execute('SELECT COUNT(*) as c FROM readings').fetchone()['c']
        anomaly_count = conn.execute('SELECT COUNT(*) as c FROM readings WHERE anomaly=1').fetchone()['c']
        train_count   = conn.execute(f"SELECT COUNT(*) as c FROM readings WHERE mq2_ao < {MQ2_AO_THRESHOLD}").fetchone()['c']

        stats = conn.execute(f'''
            SELECT
              AVG(mq2_ao)   as mq2_avg,
              MAX(mq2_ao)   as mq2_max,
              MIN(mq2_ao)   as mq2_min,
              AVG(flame_ao) as flame_avg,
              MAX(flame_ao) as flame_max,
              MIN(flame_ao) as flame_min
            FROM readings WHERE mq2_ao < {MQ2_AO_THRESHOLD}
        ''').fetchone()

    return _json_response({
        "model_ready":        MODEL_READY,
        "data_count":         count,
        "train_count":        train_count,
        "min_required":       MIN_TRAIN_ROWS,
        "anomaly_count":      anomaly_count,
        "anomaly_rate":       round(anomaly_count / count * 100, 1) if count > 0 else 0,
        "contamination":      0.01,
        "mq2_ao_threshold":   MQ2_AO_THRESHOLD,
        "flame_ao_threshold": FLAME_AO_THRESHOLD,
        "train_stats_auto":   TRAIN_STATS,
        "train_stats": {
            "mq2_avg":   round(stats['mq2_avg'],   1) if stats['mq2_avg']   else 0,
            "mq2_max":   stats['mq2_max']  or 0,
            "mq2_min":   stats['mq2_min']  or 0,
            "flame_avg": round(stats['flame_avg'], 1) if stats['flame_avg'] else 0,
            "flame_max": stats['flame_max'] or 0,
            "flame_min": stats['flame_min'] or 0,
        }
    })

@app.route('/api/ai/retrain', methods=['POST'])
def retrain():
    global model, MODEL_READY
    model       = None
    MODEL_READY = False
    threading.Thread(target=train_model, daemon=True).start()
    return _json_response({"status": "retraining"})

@app.route('/api/ai/reset', methods=['POST'])
def reset_data():
    global model, MODEL_READY, MQ2_AO_THRESHOLD, FLAME_AO_THRESHOLD, TRAIN_STATS, LAST_ALERT_TS
    model              = None
    MODEL_READY        = False
    MQ2_AO_THRESHOLD   = 300
    FLAME_AO_THRESHOLD = 500
    LAST_ALERT_TS      = { 'gas': 0, 'flame': 0, 'ai': 0 }
    TRAIN_STATS        = {
        "mq2_mean": 0, "mq2_std": 0, "mq2_threshold": 300,
        "flame_mean": 0, "flame_std": 0, "flame_threshold": 500,
    }
    with get_db() as conn:
        conn.execute('DELETE FROM readings')
        conn.execute('DELETE FROM alerts')
        conn.execute('DELETE FROM sqlite_sequence WHERE name="readings"')
        conn.execute('DELETE FROM sqlite_sequence WHERE name="alerts"')
    return _json_response({"status": "reset"})

@app.route('/api/ai/history', methods=['GET'])
def ai_history():
    with get_db() as conn:
        normal = conn.execute(f'''
            SELECT ts, mq2_ao, flame_ao, received_at
            FROM readings WHERE mq2_ao < {MQ2_AO_THRESHOLD}
            ORDER BY id DESC LIMIT 20
        ''').fetchall()
        anomaly = conn.execute('''
            SELECT ts, mq2_ao, flame_ao, received_at
            FROM readings WHERE anomaly=1
            ORDER BY id DESC LIMIT 20
        ''').fetchall()
        hourly = conn.execute(f'''
            SELECT strftime('%H', received_at) as hour, COUNT(*) as cnt
            FROM readings WHERE mq2_ao < {MQ2_AO_THRESHOLD}
            GROUP BY hour ORDER BY hour
        ''').fetchall()
        buckets = conn.execute(f'''
            SELECT CAST(mq2_ao/50 AS INT)*50 as bucket, COUNT(*) as cnt
            FROM readings WHERE mq2_ao < {MQ2_AO_THRESHOLD}
            GROUP BY bucket ORDER BY bucket
        ''').fetchall()

    return _json_response({
        "normal_samples":  [dict(r) for r in normal],
        "anomaly_samples": [dict(r) for r in anomaly],
        "hourly_dist":     [{"hour": r["hour"], "count": r["cnt"]} for r in hourly],
        "mq2_ao_buckets":  [{"range": f"{r['bucket']}~{r['bucket']+49}", "count": r["cnt"]} for r in buckets],
    })

@app.route('/dashboard', methods=['GET'])
def dashboard():
    with get_db() as conn:
        rows = conn.execute(
            'SELECT * FROM readings ORDER BY id DESC LIMIT 60'
        ).fetchall()
        alerts = conn.execute(
            'SELECT * FROM alerts ORDER BY id DESC LIMIT 10'
        ).fetchall()
        total         = conn.execute('SELECT COUNT(*) as c FROM readings').fetchone()['c']
        anomaly_count = conn.execute('SELECT COUNT(*) as c FROM readings WHERE anomaly=1').fetchone()['c']

    rows   = list(reversed([dict(r) for r in rows]))
    alerts = [dict(a) for a in alerts]

    labels       = [r['received_at'][11:19] for r in rows]
    mq2_ao_data  = [r['mq2_ao']   for r in rows]
    flame_ao_data= [r['flame_ao'] for r in rows]
    anomaly_data = [r['anomaly']  for r in rows]

    latest_mq2   = rows[-1]['mq2_ao']   if rows else 0
    latest_flame = rows[-1]['flame_ao'] if rows else 0

    TYPE_LABEL = {
        'FIRE':      '화재',
        'FLAME':     '불꽃 감지',
        'GAS_SMOKE': '가스/연기',
        'ANOMALY':   'AI 이상',
    }
    alert_rows_html = ''
    for a in alerts:
        if a['type'] in ['FIRE', 'FLAME']:
            badge_cls = 'badge-danger'
        elif a['type'] == 'ANOMALY':
            badge_cls = 'badge-ai'
        else:
            badge_cls = 'badge-warn'
        label    = TYPE_LABEL.get(a['type'], a['type'])
        ai_badge = '<span class="badge badge-ai">이상</span>' if a['ai_anomaly'] else '-'
        alert_rows_html += f"""<tr>
    <td>{a['ts'][5:19]}</td>
    <td><span class="badge {badge_cls}">{label}</span></td>
    <td>{a['mq2_ao']}</td>
    <td>{a['flame_ao']}</td>
    <td>{ai_badge}</td>
  </tr>"""
    if not alert_rows_html:
        alert_rows_html = '<tr><td colspan="5" style="color:#8890b0;text-align:center">경고 없음</td></tr>'

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta http-equiv="refresh" content="3">
<title>창고 화재 모니터링</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  body {{ font-family: sans-serif; background:#0f1117; color:#f0f2ff; margin:0; padding:20px; }}
  h1 {{ color:#4f8ef7; }} h2 {{ color:#8890b0; font-size:14px; }}
  .cards {{ display:flex; gap:16px; margin-bottom:24px; flex-wrap:wrap; }}
  .card {{ background:#1a1d27; border-radius:12px; padding:16px 24px; flex:1; min-width:140px; border:1px solid #2c3050; }}
  .card .val {{ font-size:32px; font-weight:800; margin-top:8px; }}
  .card .sub {{ font-size:12px; color:#8890b0; margin-top:4px; }}
  .ok {{ color:#2ecc71; }} .danger {{ color:#e74c3c; }} .warn {{ color:#f39c12; }} .ai {{ color:#a855f7; }}
  .chart-box {{ background:#1a1d27; border-radius:12px; padding:16px; margin-bottom:20px; border:1px solid #2c3050; }}
  table {{ width:100%; border-collapse:collapse; background:#1a1d27; border-radius:12px; overflow:hidden; }}
  th {{ background:#22263a; padding:10px; text-align:left; color:#8890b0; font-size:13px; }}
  td {{ padding:10px; border-bottom:1px solid #2c3050; font-size:13px; }}
  .badge {{ padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; }}
  .badge-danger {{ background:#e74c3c33; color:#e74c3c; border:1px solid #e74c3c66; }}
  .badge-warn   {{ background:#f39c1233; color:#f39c12; border:1px solid #f39c1266; }}
  .badge-ai     {{ background:#a855f733; color:#a855f7; border:1px solid #a855f766; }}
  .threshold-box {{ background:#1a1d27; border-radius:12px; padding:16px; margin-bottom:20px; border:1px solid #2c3050; display:flex; gap:32px; }}
  .thr-item {{ display:flex; flex-direction:column; gap:4px; }}
  .thr-label {{ font-size:12px; color:#8890b0; }}
  .thr-val {{ font-size:20px; font-weight:800; }}
</style>
</head>
<body>
<h1>창고 화재·이상 징후 모니터링</h1>
<p style="color:#8890b0;font-size:13px;">3초 자동 갱신 중 | AI: {'✅ 모델 준비됨' if MODEL_READY else '⏳ 학습 중'}</p>

<div class="cards">
  <div class="card">
    <h2>총 수집 데이터</h2>
    <div class="val" style="color:#4f8ef7">{total}</div>
  </div>
  <div class="card">
    <h2>AI 이상 감지</h2>
    <div class="val {'danger' if anomaly_count > 0 else 'ok'}">{anomaly_count}</div>
  </div>
  <div class="card">
    <h2>MQ-2 AO (현재)</h2>
    <div class="val {'danger' if latest_mq2 >= MQ2_AO_THRESHOLD else 'ok'}">{latest_mq2}</div>
    <div class="sub">임계값: {MQ2_AO_THRESHOLD} 이상 → 경고</div>
  </div>
  <div class="card">
    <h2>불꽃 AO (현재)</h2>
    <div class="val {'danger' if latest_flame <= FLAME_AO_THRESHOLD else 'ok'}">{latest_flame}</div>
    <div class="sub">임계값: {FLAME_AO_THRESHOLD} 이하 → 경고</div>
  </div>
</div>

<div class="threshold-box">
  <div class="thr-item">
    <span class="thr-label">AI 모델</span>
    <span class="thr-val" style="color:#a855f7">Isolation Forest</span>
  </div>
  <div class="thr-item">
    <span class="thr-label">MQ-2 평균 (학습)</span>
    <span class="thr-val" style="color:#f39c12">{TRAIN_STATS['mq2_mean']}</span>
  </div>
  <div class="thr-item">
    <span class="thr-label">MQ-2 표준편차</span>
    <span class="thr-val" style="color:#f39c12">±{TRAIN_STATS['mq2_std']}</span>
  </div>
  <div class="thr-item">
    <span class="thr-label">MQ-2 경고 임계값 (평균+2σ)</span>
    <span class="thr-val" style="color:#e74c3c">{MQ2_AO_THRESHOLD}</span>
  </div>
  <div class="thr-item">
    <span class="thr-label">불꽃 경고 임계값 (평균-2σ)</span>
    <span class="thr-val" style="color:#e74c3c">{FLAME_AO_THRESHOLD}</span>
  </div>
</div>

<div class="chart-box">
  <h2>MQ-2 AO / 불꽃 AO / AI 이상치 (최근 60개)</h2>
  <canvas id="chart" height="80"></canvas>
</div>

<h2 style="margin-bottom:8px">최근 경고 이력</h2>
<table>
  <tr><th>시각</th><th>유형</th><th>MQ-2 AO</th><th>불꽃 AO</th><th>AI 이상</th></tr>
  {alert_rows_html}
</table>

<script>
const ctx = document.getElementById('chart').getContext('2d');
new Chart(ctx, {{
  type: 'line',
  data: {{
    labels: {labels},
    datasets: [
      {{
        label: 'MQ-2 AO',
        data: {mq2_ao_data},
        borderColor: '#f39c12',
        backgroundColor: 'transparent',
        tension: 0.3, pointRadius: 2, yAxisID: 'y',
      }},
      {{
        label: '불꽃 AO',
        data: {flame_ao_data},
        borderColor: '#e74c3c',
        backgroundColor: 'transparent',
        tension: 0.3, pointRadius: 2, yAxisID: 'y',
      }},
      {{
        label: 'AI 이상치',
        data: {anomaly_data},
        borderColor: '#a855f7',
        backgroundColor: '#a855f722',
        fill: true,
        tension: 0.3, pointRadius: 2, yAxisID: 'y2',
      }}
    ]
  }},
  options: {{
    scales: {{
      y:  {{ position:'left',  min:0, max:1023, grid:{{color:'#2c3050'}}, ticks:{{color:'#8890b0'}} }},
      y2: {{ position:'right', min:-0.1, max:1.5, grid:{{drawOnChartArea:false}}, ticks:{{color:'#a855f7'}} }},
      x:  {{ ticks:{{color:'#8890b0', maxTicksLimit:10}} }}
    }},
    plugins: {{ legend: {{ labels: {{ color:'#f0f2ff' }} }} }}
  }}
}});
</script>
</body></html>"""
    return html

def _json_response(data):
    return app.response_class(
        response=json.dumps(data, ensure_ascii=False, indent=2),
        status=200,
        mimetype='application/json; charset=utf-8'
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
