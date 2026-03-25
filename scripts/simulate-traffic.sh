#!/bin/bash
# Usage: ./scripts/simulate-traffic.sh https://pizza-service.urjellis.com [num_buyers] [workers]
# num_buyers: total number of buy cycles to simulate (default: 100)
# workers:    max concurrent workers at any time (default: 20)
#
# Uses a worker pool + exponential backoff so the server isn't overwhelmed
# regardless of how large num_buyers is.

if [ -z "$1" ]; then
  echo "Usage: $0 <host> [num_buyers] [workers]"
  echo "Example: $0 https://pizza-service.urjellis.com 1000 30"
  exit 1
fi

host=$1
num_buyers=${2:-100}
max_workers=${3:-20}

CURL_OPTS="--silent --max-time 10 --connect-timeout 5"

echo "Simulating $num_buyers buy cycles against $host (max $max_workers concurrent workers)"

cleanup() {
  echo "Stopping..."
  kill 0
  exit 0
}
trap cleanup SIGINT SIGTERM

# Retry a curl command with exponential backoff + jitter.
# Usage: retry_curl <max_attempts> curl_args...
# Returns curl's output on success; empty string on all-attempts exhausted.
retry_curl() {
  local max=$1; shift
  local attempt=0
  local wait=1
  while (( attempt < max )); do
    local out
    out=$(curl $CURL_OPTS "$@" 2>/dev/null)
    local status=$?
    if [[ $status -eq 0 && -n "$out" ]]; then
      echo "$out"
      return 0
    fi
    (( attempt++ ))
    # Jitter: wait between 50–100% of the base interval
    local jitter=$(( wait * (50 + RANDOM % 50) / 100 ))
    sleep "$jitter"
    (( wait = wait * 2 > 30 ? 30 : wait * 2 ))  # cap at 30s
  done
  return 1
}

# Background: hit menu every 3s to generate steady GET + DB logs
menu_loop() {
  while true; do
    curl $CURL_OPTS -o /dev/null "$host/api/order/menu"
    sleep 3
  done
}
menu_loop &

# Background: failed logins every 15s to generate auth-failure logs
bad_login_loop() {
  while true; do
    curl $CURL_OPTS -o /dev/null -X PUT "$host/api/auth" \
      -d '{"email":"unknown@jwt.com","password":"bad"}' \
      -H 'Content-Type: application/json'
    sleep 15
  done
}
bad_login_loop &

# One buyer cycle: login → order → logout
# Returns 0 on success, 1 on any failure
buy_cycle() {
  local response token http_status

  response=$(retry_curl 3 -X PUT "$host/api/auth" \
    -d '{"email":"d@jwt.com","password":"diner"}' \
    -H 'Content-Type: application/json')

  token=$(echo "$response" | jq -r '.token // empty' 2>/dev/null)
  [[ -z "$token" ]] && return 1

  http_status=$(curl $CURL_OPTS -o /dev/null -w "%{http_code}" -X POST "$host/api/order" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer $token" \
    -d '{"franchiseId":1,"storeId":1,"items":[{"menuId":1,"description":"Veggie","price":0.05}]}')

  curl $CURL_OPTS -o /dev/null -X DELETE "$host/api/auth" \
    -H "Authorization: Bearer $token"

  echo "$http_status"
}

# Worker pool using a semaphore file-descriptor slot.
# We open a named pipe with max_workers tokens; each worker consumes
# one token for the duration of its cycle and returns it when done.
PIPE=$(mktemp -u)
mkfifo "$PIPE"
exec 9<>"$PIPE"
rm "$PIPE"

# Fill the pipe with max_workers tokens (each token = one newline byte)
for (( i=0; i<max_workers; i++ )); do
  printf '\n' >&9
done

success=0; failure=0; completed=0

for (( i=1; i<=num_buyers; i++ )); do
  # Block until a worker slot is free
  read -n 1 -u 9

  {
    status=$(buy_cycle)
    if [[ "$status" == "200" ]]; then
      (( success++ ))
    else
      (( failure++ ))
    fi
    (( completed++ ))
    echo "[$completed/$num_buyers] status=${status:-err} ok=$success fail=$failure"
    # Return the slot
    printf '\n' >&9
  } &

  # Small stagger to avoid thundering herd on startup
  sleep 0.05
done

# Wait for all in-flight workers to finish
wait
echo "Done. $success successful purchases, $failure failures out of $num_buyers cycles."
