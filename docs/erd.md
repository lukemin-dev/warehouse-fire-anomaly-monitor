# ERD — 창고 화재·이상 징후 감지 시스템


---

## 엔티티 관계도

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────────┐
│   Device    │ 1   N │  SensorReading  │ N   1 │     Alert        │
│─────────────│───────│─────────────────│───────│──────────────────│
│ PK id       │       │ PK id           │       │ PK id            │
│    name     │       │ FK device_id    │       │ FK device_id     │
│    ip       │       │    ts           │       │ FK reading_id    │
│    location │       │    gas_value    │       │    ts            │
│    status   │       │    flame        │       │    type          │
│    created_at│      │    gas_triggered│       │    resolved_at   │
└─────────────┘       └─────────────────┘       └──────────────────┘
                                                         │
                                                 ┌───────┴────────┐
                                                 │  ThresholdConfig│
                                                 │────────────────│
                                                 │ PK id          │
                                                 │ FK device_id   │
                                                 │  gas_threshold │
                                                 │  updated_at    │
                                                 └────────────────┘
```
