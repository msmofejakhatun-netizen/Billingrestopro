#!/bin/env bash
# ==============================================================================
# RESTOPRO ENTERPRISE ROS - MONGO REPLICA SET INITIALIZATION ENGINE
# ==============================================================================
# This scripts waits for the three primary, replica, and arbiter Mongo instances
# to accept TCP connections, and boots the "rsProd" replica set configuration.
# ==============================================================================

set -euo pipefail

echo "[INFO] Commencing MongoDB Replica Set initialization verify..."

# Function to check if a port is open
wait_for_port() {
  local host=$1
  local port=$2
  echo "[INFO] Checking port status for ${host}:${port}..."
  until nc -z "${host}" "${port}" >/dev/null 2>&1; do
    echo "[WARNING] Port is not reachable yet. Sleeping 2s..."
    sleep 2
  done
  echo "[SUCCESS] Unlocked port for ${host}:${port}!"
}

# Wait for Mongo nodes to become accessible on network
wait_for_port "mongo1" 27017
wait_for_port "mongo2" 27017
wait_for_port "mongo3" 27017

echo "[INFO] All MongoDB Cluster nodes are reachable. Initializing configuration..."

# Execute initiating script on mongo1 (Primary node nominee)
mongosh --host "mongo1:27017" --eval '
try {
  var status = rs.status();
  print("[INFO] Replica Set already initiated. Current Status configuration OK.");
} catch(e) {
  print("[INFO] Initiating brand new Replica Set config \"rsProd\"...");
  var res = rs.initiate({
    _id: "rsProd",
    members: [
      { _id: 0, host: "mongo1:27017", priority: 2 },
      { _id: 1, host: "mongo2:27017", priority: 1 },
      { _id: 2, host: "mongo3:27017", priority: 1 }
    ]
  });
  print("[SUCCESS] Replica Set configuration sent. Result metrics: " + JSON.stringify(res));
}
'

echo "[SUCCESS] MongoDB Replica cluster deployment completed!"
