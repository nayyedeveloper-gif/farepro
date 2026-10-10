#!/usr/bin/env bash
# Start FarePro local stack: Postgres (docker) + Go API + Vite + Expo Driver
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.local/go/bin:/usr/local/go/bin:/opt/homebrew/bin:$PATH"
mkdir -p "$ROOT/.run" /tmp

kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -nP -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "${pids:-}" ]; then
    echo "Stopping port $port (pids: $pids)"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

echo "==> Ensuring Postgres + LiveKit"
docker start farepro-postgres livekit-redis livekit >/dev/null 2>&1 || true
for i in $(seq 1 20); do
  docker exec farepro-postgres pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 0.5
done

kill_port 8080
kill_port 5173
kill_port 8081

echo "==> Backend :8080"
cd "$ROOT/backend"
if [ ! -x bin/server ]; then
  CGO_ENABLED=0 go build -o bin/server ./cmd/server/
fi
nohup env DEMO_MODE=true DEMO_PASSWORD='Demo@2026' ./bin/server \
  > /tmp/farepro-backend.log 2>&1 &
echo $! > "$ROOT/.run/backend.pid"

echo "==> Frontend :5173"
cd "$ROOT/frontend"
nohup npm run dev -- --host 0.0.0.0 --port 5173 \
  > /tmp/farepro-frontend.log 2>&1 &
echo $! > "$ROOT/.run/frontend.pid"

echo "==> Driver Expo Metro :8081"
cd "$ROOT/mobile"
nohup env APP_VARIANT=driver npx expo start --port 8081 --clear \
  > /tmp/farepro-mobile.log 2>&1 &
echo $! > "$ROOT/.run/mobile.pid"

echo "==> Waiting for health checks"
ok=0
for i in $(seq 1 30); do
  b=$(curl -sf -m 1 http://127.0.0.1:8080/health 2>/dev/null || true)
  f=$(curl -sf -m 1 -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/ 2>/dev/null || echo 000)
  m=$(curl -sf -m 1 -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/ 2>/dev/null || echo 000)
  if echo "$b" | grep -q ok && [ "$f" = "200" ] && [ "$m" = "200" ]; then
    ok=1
    break
  fi
  sleep 1
done

echo ""
echo "Backend:  http://localhost:8080/health  -> $(curl -sf http://127.0.0.1:8080/health || echo FAIL)"
echo "Frontend: http://localhost:5173/        -> HTTP $(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/ || echo FAIL)"
echo "Driver:   http://localhost:8081/        -> HTTP $(curl -sf -o /dev/null -w '%{http_code}' http://127.0.0.1:8081/ || echo FAIL)"
echo ""
echo "Demo driver login:"
echo "  subdomain: demo"
echo "  phone:     09000000201"
echo "  password:  Demo@2026"
echo ""
echo "Logs: /tmp/farepro-backend.log  /tmp/farepro-frontend.log  /tmp/farepro-mobile.log"
if [ "$ok" != "1" ]; then
  echo "WARNING: some services may still be starting — check logs above"
  exit 1
fi
