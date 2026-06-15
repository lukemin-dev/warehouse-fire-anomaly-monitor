import os
import subprocess
import time

KEY_PATH = os.environ["FIRE_SSH_KEY"]
SERVER_HOST = os.environ["FIRE_SERVER_HOST"]
APP_PATH = os.environ.get("FIRE_SERVER_APP", "server/app.py")
REMOTE_APP_PATH = os.environ.get("FIRE_REMOTE_APP", "~/warehouse-server/app.py")


def run_ssh(command: str) -> None:
    subprocess.run(
        ["ssh", "-i", KEY_PATH, "-o", "StrictHostKeyChecking=no", f"ubuntu@{SERVER_HOST}", command],
        check=True,
    )


def run_scp(source: str, destination: str) -> None:
    subprocess.run(
        ["scp", "-i", KEY_PATH, "-o", "StrictHostKeyChecking=no", source, f"ubuntu@{SERVER_HOST}:{destination}"],
        check=True,
    )


print("1. Upload Flask app")
run_scp(APP_PATH, REMOTE_APP_PATH)

print("2. Restart service")
run_ssh("sudo systemctl restart warehouse")

time.sleep(3)

print("3. Check AI status")
run_ssh("curl -s http://localhost:5000/api/ai/status")
