import mongoose from "mongoose";
import Device from "../models/Device";
import { Vendor, PurchaseOrder, GoodsReceiptNote, WastageLog, StockTransfer } from "../models/AdvancedInventory";
import { Ingredient, InventoryStock, StockTransaction } from "../models/Inventory";
import Notification from "../models/Notification";
import OTAUpdate from "../models/OTAUpdate";
import Table from "../models/Table";
import { MenuCategory, MenuItem } from "../models/Menu";
import { Order } from "../models/Order";
import { emitToBranch, emitToRestaurant } from "../sockets/socketService";

// --- DEVICE MANAGEMENT SERVICE ---
export class DeviceService {
  static async registerDevice(data: {
    deviceId: string;
    restaurantId: string;
    branchId: string;
    deviceName: string;
    deviceModel: string;
    osVersion: string;
    captainId?: string;
    assignedCaptainName?: string;
  }) {
    const existing = await (Device as any).findOne({ deviceId: data.deviceId });
    if (existing) {
      existing.restaurantId = data.restaurantId;
      existing.branchId = data.branchId;
      existing.deviceName = data.deviceName;
      existing.deviceModel = data.deviceModel;
      existing.osVersion = data.osVersion;
      existing.status = "ACTIVE";
      if (data.captainId) {
        existing.captainId = data.captainId;
        existing.assignedCaptainName = data.assignedCaptainName || "";
      }
      existing.lastActiveAt = new Date();
      await existing.save();
      return existing;
    }

    const newDevice = new Device({
      ...data,
      status: "ACTIVE",
      authTokenRotationVersion: 1,
      registeredAt: new Date()
    });
    await newDevice.save();
    return newDevice;
  }

  static async updateHeartbeat(deviceId: string) {
    const dev = await (Device as any).findOne({ deviceId });
    if (!dev) return null;
    dev.lastActiveAt = new Date();
    await dev.save();
    return dev;
  }

  static async verifySession(deviceId: string, tokenVersion: number): Promise<boolean> {
    const dev = await (Device as any).findOne({ deviceId });
    if (!dev || dev.status !== "ACTIVE" || dev.authTokenRotationVersion !== tokenVersion) {
      return false;
    }
    return true;
  }

  static async remoteLogout(deviceId: string) {
    const dev = await (Device as any).findOne({ deviceId });
    if (!dev) return false;
    dev.status = "REVOKED";
    dev.authTokenRotationVersion += 1; // invalidate current JWT
    await dev.save();
    return true;
  }

  static async resetAllTokensInBranch(branchId: string) {
    await (Device as any).updateMany(
      { branchId, status: "ACTIVE" },
      { $inc: { authTokenRotationVersion: 1 }, $set: { status: "EXPIRED" } }
    );
    return true;
  }

  static async getActiveDevices(branchId: string) {
    return await (Device as any).find({ branchId, status: "ACTIVE" });
  }
}

// --- SYNC ENGINE SERVICE ---
export class SyncEngineService {
  /**
   * Delta Sync pulls all documents updated after specific timestamps per entity
   */
  static async getDeltaSyncPayload(
    restaurantId: string,
    branchId: string,
    syncTimestamps: {
      tables?: string;
      categories?: string;
      menuItems?: string;
      stock?: string;
    }
  ) {
    const filterAndFind = async (model: any, lastUpdatedStr?: string, extraQuery: any = {}) => {
      const query: any = { restaurantId, ...extraQuery };
      if (lastUpdatedStr) {
        const lastDate = new Date(lastUpdatedStr);
        if (!isNaN(lastDate.getTime())) {
          query.updatedAt = { $gt: lastDate };
        }
      }
      return await (model as any).find(query);
    };

    const deltaTables = await filterAndFind(Table, syncTimestamps.tables, { branchId });
    const deltaCategories = await filterAndFind(MenuCategory, syncTimestamps.categories);
    const deltaMenuItems = await filterAndFind(MenuItem, syncTimestamps.menuItems);
    
    // Inventory Stock
    const stockQuery: any = { restaurantId, branchId };
    if (syncTimestamps.stock) {
      const lastDate = new Date(syncTimestamps.stock);
      if (!isNaN(lastDate.getTime())) {
        stockQuery.updatedAt = { $gt: lastDate };
      }
    }
    const deltaStock = await (InventoryStock as any).find(stockQuery).populate("ingredientId");

    return {
      version: {
        serverTimestamp: new Date().toISOString()
      },
      tables: deltaTables,
      categories: deltaCategories,
      menuItems: deltaMenuItems,
      stock: deltaStock
    };
  }
}

// --- NOTIFICATION SERVICE ---
export class NotificationService {
  static async triggerAlert(
    restaurantId: string,
    branchId: string | undefined,
    data: {
      type: 'KOT_READY' | 'BILL_GENERATED' | 'PAYMENT_COMPLETED' | 'PRINTER_OFFLINE' | 'STOCK_LOW' | 'LOGIN_ALERT' | 'ALERT';
      title: string;
      message: string;
      severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    }
  ) {
    const notify = new Notification({
      restaurantId,
      branchId,
      type: data.type,
      title: data.title,
      message: data.message,
      severity: data.severity || "INFO"
    });
    await notify.save();

    // Broadcast to branch if specified, otherwise whole restaurant
    const evtPayload = {
      _id: notify._id,
      type: notify.type,
      title: notify.title,
      message: notify.message,
      severity: notify.severity,
      createdAt: notify.createdAt
    };

    if (branchId) {
      emitToBranch(branchId, "new-notification", evtPayload);
    } else {
      emitToRestaurant(restaurantId, "new-notification", evtPayload);
    }

    return notify;
  }

  static async markAsRead(notificationId: string, userId: string) {
    return await (Notification as any).findByIdAndUpdate(
      notificationId,
      { $addToSet: { readBy: userId } },
      { new: true }
    );
  }

  static async getActiveAlerts(branchId: string, limit = 20) {
    return await (Notification as any).find({ branchId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}

// --- ADVANCED INVENTORY SERVICE ---
export class AdvancedInventoryService {
  static async createVendor(restaurantId: string, data: any) {
    const vendor = new Vendor({ restaurantId, ...data });
    await vendor.save();
    return vendor;
  }

  static async createPO(restaurantId: string, branchId: string, poData: any) {
    const poNumber = `PO-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const grandTotal = poData.items.reduce((acc: number, it: any) => acc + (it.quantity * it.unitPrice), 0);

    const po = new PurchaseOrder({
      restaurantId,
      branchId,
      poNumber,
      vendorId: poData.vendorId,
      items: poData.items,
      grandTotal,
      status: "DRAFT",
      expectedDeliveryDate: poData.expectedDeliveryDate,
      notes: poData.notes
    });
    await po.save();
    return po;
  }

  static async receiveGoodsNote(restaurantId: string, branchId: string, data: {
    purchaseOrderId?: string;
    vendorId: string;
    items: { ingredientId: string; orderedQty: number; receivedQty: number; damageQty?: number }[];
    invoiceNumber?: string;
    invoiceAmount?: number;
    receivedBy: string;
    notes?: string;
  }) {
    const grnNumber = `GRN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const formattedItems = data.items.map(it => ({
      ingredientId: it.ingredientId,
      orderedQty: it.orderedQty,
      receivedQty: it.receivedQty,
      damageQty: it.damageQty || 0
    }));

    const grn = new GoodsReceiptNote({
      restaurantId,
      branchId,
      grnNumber,
      purchaseOrderId: data.purchaseOrderId,
      vendorId: data.vendorId,
      items: formattedItems,
      invoiceNumber: data.invoiceNumber,
      invoiceAmount: data.invoiceAmount,
      receivedBy: data.receivedBy,
      notes: data.notes
    });

    await grn.save();

    // Perform real integration: increment branch level inventory stock
    for (const it of formattedItems) {
      if (it.receivedQty <= 0) continue;

      // Find or create Stock
      let stock = await (InventoryStock as any).findOne({
        restaurantId,
        branchId,
        ingredientId: it.ingredientId
      });

      if (!stock) {
        stock = new InventoryStock({
          restaurantId,
          branchId,
          ingredientId: it.ingredientId,
          currentQuantity: 0
        });
      }

      stock.currentQuantity += it.receivedQty;
      stock.lastStockCheck = new Date();
      await stock.save();

      // Log transaction record
      const trans = new StockTransaction({
        restaurantId,
        branchId,
        ingredientId: it.ingredientId,
        type: "ADDITION",
        quantity: it.receivedQty,
        referenceId: grn._id.toString(),
        notes: `Received cargo (GRN: ${grnNumber})`,
        timestamp: new Date()
      });
      await trans.save();
    }

    if (data.purchaseOrderId) {
      // update PO status
      await (PurchaseOrder as any).findByIdAndUpdate(data.purchaseOrderId, { status: "RECEIVED" });
    }

    return grn;
  }

  static async logWastage(restaurantId: string, branchId: string, data: {
    items: { ingredientId: string; quantity: number; unitValue: number; reason: string }[];
    discardedBy: string;
  }) {
    const wastageNumber = `WST-${Date.now()}`;
    const totalLossValue = data.items.reduce((acc, it) => acc + (it.quantity * it.unitValue), 0);

    const log = new WastageLog({
      restaurantId,
      branchId,
      wastageNumber,
      items: data.items,
      totalLossValue,
      discardedBy: data.discardedBy,
      loggedAt: new Date()
    });
    await log.save();

    // Deduct stock record
    for (const it of data.items) {
      const stock = await (InventoryStock as any).findOne({
        restaurantId,
        branchId,
        ingredientId: it.ingredientId
      });
      if (stock) {
        stock.currentQuantity = Math.max(0, stock.currentQuantity - it.quantity);
        await stock.save();

        const trans = new StockTransaction({
          restaurantId,
          branchId,
          ingredientId: it.ingredientId,
          type: "DEDUCTION_WASTAGE",
          quantity: it.quantity,
          referenceId: log._id.toString(),
          notes: `Material wasted: ${it.reason}`,
          timestamp: new Date()
        });
        await trans.save();
      }
    }

    return log;
  }

  static async dispatchTransfer(restaurantId: string, data: {
    sourceBranchId: string;
    targetBranchId: string;
    items: { ingredientId: string; quantity: number }[];
    shippedBy: string;
    notes?: string;
  }) {
    const transferNumber = `TRF-${Date.now()}`;
    const transfer = new StockTransfer({
      restaurantId,
      sourceBranchId: data.sourceBranchId,
      targetBranchId: data.targetBranchId,
      transferNumber,
      items: data.items,
      status: "DISPATCHED",
      shippedAt: new Date(),
      shippedBy: data.shippedBy,
      notes: data.notes
    });

    await transfer.save();

    // Deduct from Source branch
    for (const it of data.items) {
      const stock = await (InventoryStock as any).findOne({
        restaurantId,
        branchId: data.sourceBranchId,
        ingredientId: it.ingredientId
      });
      if (stock) {
        stock.currentQuantity = Math.max(0, stock.currentQuantity - it.quantity);
        await stock.save();

        const trans = new StockTransaction({
          restaurantId,
          branchId: data.sourceBranchId,
          ingredientId: it.ingredientId,
          type: "MANUAL_ADJUST",
          quantity: it.quantity,
          referenceId: transfer._id.toString(),
          notes: `Stock Transfer Dispatched out to Branch ID: ${data.targetBranchId}`,
          timestamp: new Date()
        });
        await trans.save();
      }
    }

    return transfer;
  }

  static async receiveTransfer(restaurantId: string, transferId: string, receivedBy: string) {
    const trf = await (StockTransfer as any).findById(transferId);
    if (!trf || trf.status !== "DISPATCHED") {
      throw new Error("Transfer request not valid or already completed");
    }

    trf.status = "RECEIVED";
    trf.receivedAt = new Date();
    trf.receivedBy = receivedBy;
    await trf.save();

    // Add to target branch Stock
    for (const it of trf.items) {
      let stock = await (InventoryStock as any).findOne({
        restaurantId,
        branchId: trf.targetBranchId.toString(),
        ingredientId: it.ingredientId
      });

      if (!stock) {
        stock = new InventoryStock({
          restaurantId,
          branchId: trf.targetBranchId.toString(),
          ingredientId: it.ingredientId,
          currentQuantity: 0
        });
      }

      stock.currentQuantity += it.quantity;
      stock.lastStockCheck = new Date();
      await stock.save();

      const trans = new StockTransaction({
        restaurantId,
        branchId: trf.targetBranchId.toString(),
        ingredientId: it.ingredientId,
        type: "ADDITION",
        quantity: it.quantity,
        referenceId: trf._id.toString(),
        notes: `Stock Transfer Received from Branch ID: ${trf.sourceBranchId}`,
        timestamp: new Date()
      });
      await trans.save();
    }

    return trf;
  }
}

// --- CLOUD BACKUP SERVICE ---
export class CloudBackupService {
  static async backupBranchData(restaurantId: string, branchId: string) {
    const tables = await (Table as any).find({ restaurantId, branchId });
    const stock = await (InventoryStock as any).find({ restaurantId, branchId }).populate("ingredientId");
    const categories = await (MenuCategory as any).find({ restaurantId });
    const items = await (MenuItem as any).find({ restaurantId });
    const recentOrders = await (Order as any).find({ restaurantId, branchId }).limit(100);

    const snapshot = {
      restaurantId,
      branchId,
      exportedAt: new Date().toISOString(),
      tables,
      stock,
      categories,
      items,
      recentOrders
    };

    // Return as Crypted/Compressed or human readable base64 raw string
    const stringified = JSON.stringify(snapshot);
    const backupBuffer = Buffer.from(stringified, "utf-8").toString("base64");

    return {
      fileName: `backup_${branchId}_${Date.now()}.json.enc`,
      payload: backupBuffer,
      summary: {
        tablesCount: tables.length,
        stockItemsCount: stock.length,
        categoriesCount: categories.length,
        itemsCount: items.length,
        ordersCount: recentOrders.length
      }
    };
  }

  static async restoreBranchSnapshot(restaurantId: string, branchId: string, base64Payload: string) {
    const rawString = Buffer.from(base64Payload, "base64").toString("utf-8");
    const data = JSON.parse(rawString);

    if (data.branchId !== branchId || data.restaurantId !== restaurantId) {
      throw new Error("Backup file restaurant/branch mismatch");
    }

    // Safely upsert Tables
    if (data.tables && Array.isArray(data.tables)) {
      for (const t of data.tables) {
        await (Table as any).findOneAndUpdate(
          { restaurantId, branchId, tableNumber: t.tableNumber },
          { $set: { capacity: t.capacity, status: t.status, active: t.active } },
          { upsert: true }
        );
      }
    }

    // Safely restore stock records
    if (data.stock && Array.isArray(data.stock)) {
      for (const s of data.stock) {
        if (!s.ingredientId) continue;
        await (InventoryStock as any).findOneAndUpdate(
          { restaurantId, branchId, ingredientId: s.ingredientId._id || s.ingredientId },
          { $set: { currentQuantity: s.currentQuantity } },
          { upsert: true }
        );
      }
    }

    return { success: true, message: "Snapshot loaded safely" };
  }
}

// --- OTA VERSION CONTROL SERVICE ---
export class OtaService {
  static async publishNewBuild(data: {
    versionCode: number;
    versionName: string;
    changelog: string[];
    forceUpdate: boolean;
    apkUrl: string;
    minSupportedOS?: string;
    targetDeviceType?: 'CAPTAIN_APP' | 'BILLING_STATION' | 'KDS_STATION';
  }) {
    const ota = new OTAUpdate({
      ...data,
      releaseActive: true
    });
    await ota.save();
    return ota;
  }

  static async getLatestUpdate(currentVersionCode: number, deviceType: 'CAPTAIN_APP' | 'BILLING_STATION' | 'KDS_STATION' = 'CAPTAIN_APP') {
    const latest = await (OTAUpdate as any).findOne({
      releaseActive: true,
      targetDeviceType: deviceType
    }).sort({ versionCode: -1 });

    if (!latest) {
      return { updateAvailable: false };
    }

    const updateAvailable = latest.versionCode > currentVersionCode;
    return {
      updateAvailable,
      forceUpdate: updateAvailable && latest.forceUpdate,
      latestVersionName: latest.versionName,
      latestVersionCode: latest.versionCode,
      apkUrl: latest.apkUrl,
      changelog: latest.changelog,
      minSupportedOS: latest.minSupportedOS
    };
  }
}
