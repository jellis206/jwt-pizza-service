#!/bin/bash
# Continuous traffic simulation for JWT Pizza Service
# Runs indefinitely - designed to be left running overnight and through chaos testing
# Usage: ./scripts/continuous-traffic.sh https://pizza-service.urjellis.com
#
# Run in background with: nohup ./scripts/continuous-traffic.sh https://pizza-service.urjellis.com > /tmp/pizza-traffic.log 2>&1 &

if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 https://pizza-service.urjellis.com"
  exit 1
fi

host=$1
CURL_OPTS="--silent --max-time 10 --connect-timeout 5"

echo "[$(date)] Starting continuous traffic against $host"
echo "[$(date)] PID: $$"

cleanup() {
  echo "[$(date)] Stopping all traffic loops..."
  kill 0
  exit 0
}
trap cleanup SIGINT SIGTERM

# 1) Hit menu every 3 seconds (steady GET traffic)
menu_loop() {
  while true; do
    status=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" "$host/api/order/menu")
    echo "[$(date)] menu: $status"
    sleep 3
  done
}

# 2) Bad login loop removed - only generates noise, not useful for chaos detection

# 3) Login, buy pizza, logout - every 30 seconds
buy_loop() {
  while true; do
    response=$(curl $CURL_OPTS -X PUT "$host/api/auth" \
      -d '{"email":"d@jwt.com","password":"diner"}' \
      -H 'Content-Type: application/json')
    token=$(echo "$response" | jq -r '.token // empty' 2>/dev/null)

    if [ -n "$token" ]; then
      order_resp=$(curl $CURL_OPTS -X POST "$host/api/order" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $token" \
        -d '{"franchiseId":1,"storeId":1,"items":[{"menuId":1,"description":"Veggie","price":0.05},{"menuId":2,"description":"Pepperoni","price":0.0042},{"menuId":3,"description":"Margarita","price":0.0042},{"menuId":4,"description":"Crusty","price":0.0028},{"menuId":5,"description":"Charred Leopard","price":0.0099}]}')
      order_status=$?

      # Check for chaos report URL
      report_url=$(echo "$order_resp" | jq -r '.followLinkToEndChaos // empty' 2>/dev/null)
      if echo "$order_resp" | jq -e '.message' >/dev/null 2>&1; then
        echo "[$(date)] ORDER FAILED: $(echo "$order_resp" | jq -r '.message // "unknown"') reportUrl=$report_url"
      else
        echo "[$(date)] buy: success reportUrl=$report_url"
      fi

      sleep 5
      curl $CURL_OPTS -o /dev/null -X DELETE "$host/api/auth" -H "Authorization: Bearer $token"
    else
      echo "[$(date)] buy: login_failed"
    fi
    sleep 25
  done
}

# 4) Login and stay logged in for 2 minutes (active user metrics)
session_loop() {
  while true; do
    response=$(curl $CURL_OPTS -X PUT "$host/api/auth" \
      -d '{"email":"f@jwt.com","password":"franchisee"}' \
      -H 'Content-Type: application/json')
    token=$(echo "$response" | jq -r '.token // empty' 2>/dev/null)

    if [ -n "$token" ]; then
      echo "[$(date)] session: logged_in"
      sleep 110
      curl $CURL_OPTS -o /dev/null -X DELETE "$host/api/auth" -H "Authorization: Bearer $token"
      echo "[$(date)] session: logged_out"
    else
      echo "[$(date)] session: login_failed"
    fi
    sleep 10
  done
}

# Launch all loops in background
menu_loop &
buy_loop &
session_loop &

echo "[$(date)] All traffic loops started. Press Ctrl+C to stop."
echo "[$(date)] Tip: watch for 'ORDER FAILED' lines - that means chaos is active!"

# Wait forever
wait
