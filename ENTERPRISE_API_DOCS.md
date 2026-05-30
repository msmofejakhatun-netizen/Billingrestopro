# RestoPro Enterprise ROS — Core RESTful API Directory
This documentation outlines the endpoint specifications of the RestoPro Enterprise Restaurant Operating System (ROS). These APIs power local POS terminals, Android handheld Captain devices, KDS screens, and Centralized management dashboards.

---

## 1. Authentication Layer
All requests (except authentication challenges) must include the JWT bearer token in the headers block:
```http
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

### `POST /api/captain/auth/login`
Initial login and device authentication.
- **Payload**:
  ```json
  {
    "username": "captain_johndoe",
    "password": "securepassword123",
    "deviceId": "MAC-90-E2-BA-12-CE-88"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "user": {
      "uid": "usr_90a12",
      "username": "captain_johndoe",
      "role": "CAPTAIN",
      "restaurantId": "rest_9921",
      "branchId": "branch_419"
    }
  }
  ```

---

## 2. Device Management & Fingerprinting
### `POST /api/captain/devices/register`
Logs a physical client device (terminal, handheld, or KDS) into the central registry.
- **Payload**:
  ```json
  {
    "deviceId": "MAC-90-E2-BA-12-CE-88",
    "deviceName": "Tablets Captain #4",
    "deviceModel": "Samsung Galaxy Tab A8",
    "osVersion": "Android 13 (API v33)",
    "captainId": "cap_8819",
    "assignedCaptainName": "Captain John"
  }
  ```
- **Response (210 Created)**:
  ```json
  {
    "success": true,
    "message": "Device registered in enterprise register",
    "device": {
      "deviceId": "MAC-90-E2-BA-12-CE-88",
      "status": "ACTIVE",
      "authTokenRotationVersion": 1
    }
  }
  ```

### `POST /api/captain/devices/heartbeat`
Periodic ping (every 10 seconds) to maintain registration status and verify token rotation versions.
- **Payload**:
  ```json
  {
    "deviceId": "MAC-90-E2-BA-12-CE-88"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "status": "ACTIVE",
    "authTokenRotationVersion": 1
  }
  ```

### `DELETE /api/captain/devices/:deviceId`
Remotely revokes a device session, forcing logout by increasing token rotation version indexes.

---

## 3. Hybrid Synchronization Engine
### `POST /api/captain/sync-engine/delta`
Calculates and downloads modified data packages since last synchronization timestamps.
- **Payload**:
  ```json
  {
    "tables": "2026-05-25T08:00:00.000Z",
    "categories": "2026-05-25T08:00:00.000Z",
    "menuItems": "",
    "stock": "2026-05-26T00:00:00.000Z"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "sync": {
      "version": { "serverTimestamp": "2026-05-26T05:10:51.000Z" },
      "tables": [],
      "categories": [],
      "menuItems": [],
      "stock": [
        {
          "ingredientId": {
            "name": "Mozzarella Cheese",
            "sku": "CHZ-MOZ-01",
            "minStockLevel": 10,
            "unit": "KG"
          },
          "currentQuantity": 8.5,
          "updatedAt": "2026-05-26T04:15:30.000Z"
        }
      ]
    }
  }
  ```

---

## 4. Advanced Inventory Systems
### `POST /api/captain/inventory/grn`
Records Vendor Cargo receiving (Goods Receipt Note), updating branch level stock balances on matching Ingredient indexes.
- **Payload**:
  ```json
  {
    "purchaseOrderId": "po_8819d1",
    "vendorId": "vendor_2210",
    "invoiceNumber": "INV-7712",
    "invoiceAmount": 340.50,
    "items": [
      {
        "ingredientId": "ing_cheese_8812",
        "orderedQty": 15,
        "receivedQty": 15,
        "damageQty": 0
      }
    ]
  }
  ```

### `POST /api/captain/inventory/wastage`
Logs and accounts for raw material wastage with automatic inventory stock deductions.
- **Payload**:
  ```json
  {
    "items": [
      {
        "ingredientId": "ing_tomatoes_10a",
        "quantity": 3.2,
        "unitValue": 1.5,
        "reason": "Spoilage due to chiller temperature drop"
      }
    ]
  }
  ```

### `POST /api/captain/inventory/transfers`
Dispatches stock items from the active branch to a target branch.

---

## 5. AI & Predictive Insights Engine
### `GET /api/captain/analytics/predict/top-selling`
Uses demand forecasting models to list high-probability items and daily batch suggestions.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "historicalSampleCount": 210,
    "predictions": [
      {
        "menuItemId": "mi_margarita_pizza",
        "name": "Margarita Pizza Classic",
        "historicalSalesQty": 55,
        "confidenceScore": 0.94,
        "predictedInterval": { "low": 52, "high": 63 },
        "forecastedNextWeekQty": 58,
        "suggestedPrepLevel": 8
      }
    ]
  }
  ```

### `GET /api/captain/analytics/predict/rush-hours`
Generates heat-mapped parameters for hours-of-day traffic loading to adjust chef schedules.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "rushPrediction": [
      {
        "hour": 19,
        "formattedHour": "19:00",
        "loadIndex": 35.8,
        "measuredOrdersCount": 21,
        "estimatedBillCollection": 540.25,
        "heatRank": "CRITICAL_PEAK",
        "recommendation": "Express queue activation required. Double KDS kitchen runners."
      }
    ]
  }
  ```

### `GET /api/captain/analytics/predict/low-stock`
Provides a timeline warning (runway depletion rate calculation) before essential operational stock dries out.

### `GET /api/captain/analytics/cancellation-anomalies`
Inspects void transactions for fraud risks and out-of-bounds cancellations.

---

## 6. Real-Time Dashboard & Monitoring
### `GET /api/captain/analytics/dashboard-telemetry`
High frequency graphing data for live dashboard terminals.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "summary": {
      "totalRevenueToday": 1420.50,
      "settledOrdersToday": 42,
      "activeLiveTables": 3,
      "averageSpendPerHead": 33.82
    },
    "realtimeSalesGraph": [
      { "interval": "12:00 - 14:00", "sum": 450.00, "ordersCount": 12 },
      { "interval": "18:00 - 20:00", "sum": 970.50, "ordersCount": 30 }
    ],
    "kdsMonitoringStatus": {
      "activeRunningKots": 3,
      "averagePrepTimesMinutes": 12.5,
      "alertLevel": "STANDBY"
    }
  }
  ```

---

## 7. Hardware Printer Bridge
### `POST /api/captain/sync-engine/printer/register`
Maps IP and capabilities of thermal devices. Runs in line with ESC/POS parsing rules.
- **Payload**:
  ```json
  {
    "printerId": "PRN-MAIN-KITCHEN",
    "name": "Kitchen EPSON T88",
    "ipAddress": "192.168.1.185",
    "type": "KITCHEN"
  }
  ```

### `POST /api/captain/sync-engine/printer/:printerId/test`
Generates a raw, unencoded test receipt payload byte template.
