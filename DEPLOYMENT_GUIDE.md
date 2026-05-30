# RestoPro Enterprise ROS — Production Infrastructure & Deployment Manual

This guide outlines instructions for configuring, deploying, monitoring, and scaling the RestoPro Enterprise Restaurant Operating System (ROS) backend cluster inside containerized workloads or local area branch servers.

---

## 1. Production Technology Stack Review
Our highly-available production architecture integrates the following enterprise grade structural engines:
- **Node.js (v20+)**: Powering the high throughput Express.js async API routing loop.
- **PM2**: Serving process clustering, native multi-threaded scaling matching CPU core density, and proactive memory management.
- **Nginx (Stable)**: Active SSL boundary terminator, load balancer utilizing sticky IP Pinning, rate limiter, and buffer protection.
- **MongoDB Cluster (Replica Set - v6.0)**: Guaranteed triple-redundant data storage nodes ensuring hot-failover capability.
- **Redis (v7.2)**: High efficacy pub/sub transaction router, Socket.IO multi-device synchronizer, and transient cache controller.

---

## 2. Docker Cluster Initialization

Proceed using this sequence to spin up the containerized network architecture:

### 2.1 Environmental variables configuration
Duplicate the environmental template and adjust safety credentials:
```bash
cp .env.example .env
nano .env
```
Ensure `MONGO_URI`, `REDIS_PASSWORD`, and `JWT_SECRET` are securely updated before running container sets.

### 2.2 SSL Certificates Storage
Nginx is preconfigured to terminate SSL connections securely. Place your domain fullchain and private key certificates into the designated workspace subdirectory:
```bash
mkdir -p certs
cp /etc/letsencrypt/live/pos.restopro-enterprise.co/fullchain.pem ./certs/
cp /etc/letsencrypt/live/pos.restopro-enterprise.co/privkey.pem ./certs/
```

### 2.3 Starting Container Services
Launch the entire system daemon:
```bash
docker compose up -d --build
```
This boots and builds:
1. `restopro_app_node` (Express Server Cluster on Port 3000)
2. `redis_cache_store` (Port 6379, secured with password authentication)
3. `mongo1`, `mongo2`, `mongo3` (Tri-node High Availability cluster)
4. `nginx_edge_router` (Standard HTTP/HTTPS reverse proxy on port 80 & 443)

---

## 3. High-Availability Cluster Bootstrap

### 3.1 MongoDB Replica Set Initiation
On first container deployment, execute the autonomous initialization script to establish replica replication hierarchies (`rsProd` configuration):
```bash
chmod +x ./mongo_init_replica.sh
docker compose exec restopro_backend_node /bin/sh -c "./mongo_init_replica.sh"
```
The primary database container automatically elects a master while secondary containers stream oplog transaction changes in real-time, tolerating single-node physical failures with zero transactional data loss.

### 3.2 WebSocket Scaling via Redis Pub/Sub
To accommodate 10,000+ real-time concurrent local Captain app devices, the backend operates the **Redis Socket.IO Adapter**. 
- Even when users connect to different PM2 workers or separate server hardware, events dispatched to individual branch rooms are seamlessly brokered via Redis Pub/Sub channels.
- Connection stickiness is managed cleanly by Nginx using the `ip_hash` load balancing algorithm, protecting against protocol handshaking failures.

---

## 4. PM2 Cluster Management & Optimization

When running RestoPro inside standard high-resource Linux hardware instances without full Docker containers (e.g. LAN server configurations), PM2 ensures optimal core distribution:

### Useful Administration Commands:
- **Start Cluster**:
  ```bash
  pm2 start ecosystem.config.js --env production
  ```
- **List Scaled Thread Processes**:
  ```bash
  pm2 list
  ```
- **Monitor RAM and CPU footprint in real time**:
  ```bash
  pm2 monit
  ```
- **Hot-Reload without service interruption**:
  ```bash
  pm2 reload all
  ```

---

## 5. Automated Data Protection (Backup System)

Local branches generate daily encrypted backup tarballs to protect transactional records under catastrophic outages.

### 5.1 Crontab Scheduled Backup Integration
Integrate the `/backup_rotate.sh` script into the host system crontab to run daily at 02:00 AM:
```bash
# Open crontab config
crontab -e

# Append execution rule (Replace path matching your exact repository install directory)
0 2 * * * /usr/src/app/backup_rotate.sh >> /var/log/restopro_backups.log 2>&1
```

### 5.2 Backup Cleanup / Retention
The script retains history of the trailing `14 days` of database backups securely inside `/var/backups/restopro`, continuously deleting older historical dumps to safeguard storage limits.

### 5.3 Redis Persistence and Snapshot Storage
For persistent task-queue states, Redis is configured in both hybrid snapshot (RDB) and journals mode (Append-Only File - AOF). The `docker-compose.yml` mounts a local persistent volume to retain backups:
- **AOF Frequency**: `everysec` (minimizing loss to max 1s data under sudden power shutdowns)
- **Snapshot rules**: Saves on disk when 10,000 keys change in 10 minutes, or 100 keys change in 5 minutes.

### 5.4 Host Log-Rotation (Logrotate Config)
To prevent host disks from packing up with logging output:
Create `/etc/logrotate.d/restopro` on host machines:
```nginx
/usr/src/app/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

---

## 6. Proactive Cloud Monitoring & Role Scaling

RestoPro ROS includes unified telemetry channels to audit physical environments:

### 6.1 Multi-Tier Health & Telemetry Check
Systems query the baseline health route:
- **Endpoint**: `/api/health`
- **Output**: Returns JSON status reports detailing CPU, resident memory, database health, Redis connections, API latencies, active Socket.io triggers, and any recent exceptions. Keeps full observability available instantly.

### 6.2 Host Scale & Role Isolation Setup
To support enterprise scaling requirements, separate your nodes cleanly inside PM2 or Kubernetes:
- **API Node Pool (BOOT_API=true, BOOT_WORKER=false)**: Concentrates strictly on handling HTTP REST API and heavy socket.io payload handshakes.
- **Worker Node Pool (BOOT_API=false, BOOT_WORKER=true)**: Dedicated container nodes consuming background BullMQ tasks (Sync, Analytics, Backups, Print queues) to protect REST thread pool latencies.

### 6.3 Printer Hardware Health Inspections
POS terminals flag printer network dropouts immediately via the telemetry reporter api:
- **Endpoint**: `/api/captain/sync-engine/printer/report-offline`
In-house servers immediately translate the payload to dispatch warnings onto active Captain screen alerts and log KDS exceptions.

---

## 7. Enterprise Monitoring & Observability Dashboard APIs

RestoPro Enterprise includes a suite of highly instrumented dashboard APIs specifically designed to hook into Grafana, Datadog, or custom React operation consoles.

### 7.1 Overview Dashboard API
- **Endpoint**: `GET /api/admin/monitoring/overview`
- **Access**: Restricted to Roles `SUPER_ADMIN`, `OWNER`, `MANAGER`.
- **Metrics Collected**:
  - Live system status check & system uptime.
  - Active incident list (Database, Redis, Resource Exhaustion, Backlog spikes).
  - Average Database query timings (ms) and replica synchronization indicator.
  - Redis memory and parsed connection stats.
  - Active REST API transaction totals, active connections, and error ratios.
  - Real-time Socket.IO connection and room counts.
  - Consolidated queue metrics (active, completed, failed, delayed, and DLQ jobs).

### 7.2 Background Queues Observability API
- **Endpoint**: `GET /api/admin/monitoring/queues`
- **Access**: Restricted to Roles `SUPER_ADMIN`, `OWNER`, `MANAGER`.
- **Metrics Collected**:
  - Breakdown of job states across all queues (Offline Sync, Printer, Notification, Analytics, Backup).
  - Worker health status (online thread counts).
  - Concurrency specifications allocated per node.
  - Dead Letter Queue (DLQ) diagnostic counts for poisoned job auditing.

### 7.3 Cache & Redis Node Diagnostics API
- **Endpoint**: `GET /api/admin/monitoring/redis`
- **Access**: Restricted to Roles `SUPER_ADMIN`, `OWNER`, `MANAGER`.
- **Metrics Collected**:
  - Precise network ping latency (ms) to the Redis node.
  - Formatted memory usage, Resident Set size (RSS), and peak historic memory footprint.
  - Client connections, blocked clients, and processed operations totals.
  - Replication roles and clustering sharding state.

### 7.4 Socket.IO Real-time Connection API
- **Endpoint**: `GET /api/admin/monitoring/sockets`
- **Access**: Restricted to Roles `SUPER_ADMIN`, `OWNER`, `MANAGER`.
- **Metrics Collected**:
  - Total active socket.io client connections.
  - Active rooms details (restaurants isolation groups and branches).
  - Connection adapters state (local vs clustered).
  - Inbound and outbound events telemetry tracking.

### 7.5 Real-time Alarm Alerting & Webhooks
RestoPro features an active alerting router configured inside `/services/alertingService.ts` that proactively monitors infrastructure indicators and triggers notifications:
- **Critial Triggers**: DB dropouts, Redis errors, High memory usage bounds (>1.25GB RSS), and excessive queue wait lists.
- **Alert Channels**: Supports webhook broadcasts (e.g. Slack Ops, PagerDuty incidents) and console logs email notifications.
- **Manage Webhooks**:
  - `GET /api/admin/monitoring/webhooks` - Retrieve integrated channels.
  - `POST /api/admin/monitoring/webhooks` - Add live channels.
  - `PATCH /api/admin/monitoring/webhooks/:id/toggle` - Activate/Deactivate alert lines.
  - `POST /api/admin/monitoring/alerts/test` - Trigger simulated critical alarms to verify channel integration.
