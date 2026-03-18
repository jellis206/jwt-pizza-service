#!/bin/bash
# Usage: ./scripts/simulate-traffic.sh https://pizza-service.urjellis.com

if [ -z "$1" ]; then
  echo "Usage: $0 <host>"
  echo "Example: $0 https://pizza-service.urjellis.com"
  exit 1
fi

host=$1
echo "Simulating traffic against $host"

cleanup() {
  echo "Stopping traffic simulation..."
  kill 0
  exit 0
}
trap cleanup SIGINT SIGTERM

# Hit menu every 3 seconds (GET requests)
while true; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$host/api/order/menu")
  echo "Requesting menu... $status"
  sleep 3
done &

# Invalid login every 25 seconds (auth failures)
while true; do
  status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$host/api/auth" \
    -d '{"email":"unknown@jwt.com","password":"bad"}' \
    -H 'Content-Type: application/json')
  echo "Logging in with invalid credentials... $status"
  sleep 25
done &

# Login, buy one pizza, logout — every 50 seconds (active users, pizza sold, revenue, latency)
while true; do
  response=$(curl -s -X PUT "$host/api/auth" \
    -d '{"email":"d@jwt.com","password":"diner"}' \
    -H 'Content-Type: application/json')
  token=$(echo "$response" | jq -r '.token')
  echo "Login diner... $(echo "$response" | jq -r '.user.name // "failed"')"

  if [ "$token" != "null" ] && [ -n "$token" ]; then
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$host/api/order" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $token" \
      -d '{"franchiseId":1,"storeId":1,"items":[{"menuId":1,"description":"Veggie","price":0.05}]}')
    echo "Bought a pizza... $status"
    sleep 20
    curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
    echo "Logged out diner"
  fi
  sleep 30
done &

# Login, buy 21 pizzas to cause failure, logout — every 5 minutes (pizza failures)
while true; do
  response=$(curl -s -X PUT "$host/api/auth" \
    -d '{"email":"d@jwt.com","password":"diner"}' \
    -H 'Content-Type: application/json')
  token=$(echo "$response" | jq -r '.token')
  echo "Login hungry diner..."

  if [ "$token" != "null" ] && [ -n "$token" ]; then
    items='{"menuId":1,"description":"Veggie","price":0.05}'
    for (( i=0; i < 21; i++ )); do
      items+=',{"menuId":1,"description":"Veggie","price":0.05}'
    done
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$host/api/order" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $token" \
      -d "{\"franchiseId\":1,\"storeId\":1,\"items\":[$items]}")
    echo "Bought too many pizzas... $status"
    sleep 5
    curl -s -X DELETE "$host/api/auth" -H "Authorization: Bearer $token" > /dev/null
    echo "Logging out hungry diner"
  fi
  sleep 295
done &

wait
