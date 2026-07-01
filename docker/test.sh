#!/bin/sh

children=""

stop() {
  if [ -n "$children" ]; then
    kill $children 2>/dev/null
  fi
  exit 130
}

trap stop INT TERM

while true; do
  curl http://localhost:8000 &
  first=$!
  curl http://localhost:8001 &
  second=$!
  curl http://localhost:8002 &
  third=$!
  children="$first $second $third"

  wait "$first"
  wait "$second"
  wait "$third"
  children=""
done
