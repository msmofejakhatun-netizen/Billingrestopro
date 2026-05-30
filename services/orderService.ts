import { orderRepo, tableRepo, kotRepo, billRepo, settlementRepo, menuItemRepo } from "../repositories";
import { emitToRestaurant } from "../sockets/socketService";
import { Recipe, InventoryStock, StockTransaction } from "../models/Inventory";
import AuditLog from "../models/AuditLog";
import mongoose from "mongoose";
import { PaymentMode, KOTStatus } from "../models/Order";

export class OrderService {
  // Helpers
  static generateId(prefix: string) {
    return `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
  }

  // 1. CREATE CUSTOM ORDER (POST /orders) with Multi-Branch Support
  static async createOrder(restaurantId: string, branchId: string, data: {
    tableId: string;
    captainId: string;
    captainName: string;
    items: any[];
    notes?: string;
    offlineId?: string;
  }) {
    const table = await tableRepo.findById(data.tableId);
    if (!table) throw new Error("Table matching ID not found.");

    // Prevent duplicates if offlineId is synced
    if (data.offlineId) {
      const existing = await orderRepo.findOne({ restaurantId, branchId, offlineId: data.offlineId });
      if (existing) {
        return existing;
      }
    }

    // Calculate subtotal, tax, grand total
    let subTotal = 0;
    const itemsWithTotals = data.items.map(item => {
      const variantCost = item.variantName ? (item.price || 0) : item.price;
      const addonsCost = (item.addons || []).reduce((acc: number, add: any) => acc + (add.price || 0), 0);
      const unitTotal = (variantCost + addonsCost);
      const lineTotal = unitTotal * item.quantity;
      subTotal += lineTotal;

      return {
        ...item,
        price: unitTotal,
        addons: item.addons || [],
        voidedQuantity: 0,
        isKitchenDone: false
      };
    });

    // Compute standard GST tax (5.0%)
    const taxAmount = parseFloat((subTotal * 0.05).toFixed(2));
    const grandTotal = subTotal + taxAmount;

    // Save Order Document with audit logs
    const orderDoc = await orderRepo.create({
      restaurantId,
      branchId,
      tableId: data.tableId,
      tableNumber: table.tableNumber,
      captainId: data.captainId,
      captainName: data.captainName,
      items: itemsWithTotals,
      status: "RUNNING",
      subTotal,
      taxAmount,
      discountAmount: 0,
      grandTotal,
      offlineId: data.offlineId,
      isSynced: true,
      notes: data.notes || "",
      auditTrail: [{
        action: "ORDER_CREATED",
        userId: data.captainId,
        userName: data.captainName,
        timestamp: new Date(),
        notes: `Order created for Table ${table.tableNumber}`
      }]
    });

    // Update Table status to RUNNING
    await tableRepo.updateById(data.tableId, {
      status: "RUNNING",
      currentOrderId: orderDoc._id,
      occupiedSince: new Date()
    });

    // Create corresponding KOT (KOT Numbering)
    const kotId = this.generateId("KOT");
    await kotRepo.create({
      restaurantId,
      branchId,
      kotId,
      orderId: orderDoc._id,
      items: itemsWithTotals,
      kotType: 'NEW',
      status: "PENDING",
      resendCount: 0
    });

    // Notify relative rooms
    emitToRestaurant(restaurantId, "order_created", { order: orderDoc, tableNumber: table.tableNumber });
    emitToRestaurant(restaurantId, "table_status_changed", { tableId: data.tableId, status: "RUNNING" });
    emitToRestaurant(restaurantId, "kot_sent", { orderId: orderDoc._id, kotId });

    return orderDoc;
  }

  // 2. PATCH ORDERS (PATCH /orders/:id)
  static async updateOrder(orderId: string, updateData: any) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new Error("Order matching ID not found.");

    const updated = await orderRepo.updateById(orderId, updateData);

    emitToRestaurant(order.restaurantId.toString(), "order_updated", updated);
    return updated;
  }

  // 3. GET ACTIVE ORDERS
  static async getRunningOrders(restaurantId: string, branchId?: string) {
    const query: any = { restaurantId, status: "RUNNING" };
    if (branchId) {
      query.branchId = branchId;
    }
    return await orderRepo.find(query);
  }

  // 4. SUBMIT ADDITIONAL KOT FOR STANDING ORDER
  static async submitKOT(orderId: string, items: any[]) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new Error("Order matching ID not found.");

    // Generate specific incremental KOT number
    const kotId = this.generateId("KOT");
    const newKot = await kotRepo.create({
      restaurantId: order.restaurantId.toString(),
      branchId: order.branchId.toString(),
      kotId,
      orderId,
      items: items.map(it => ({ ...it, addons: it.addons || [], voidedQuantity: 0, isKitchenDone: false })),
      kotType: 'ADDON',
      status: "PENDING",
      resendCount: 0
    });

    // Append items to order or increment existing quantites
    let subtotalDiff = 0;
    const additionalItems = items.map(item => {
      const addonsCost = (item.addons || []).reduce((acc: number, add: any) => acc + (add.price || 0), 0);
      const unitTotal = (item.price + addonsCost);
      subtotalDiff += unitTotal * item.quantity;
      return {
        ...item,
        price: unitTotal,
        addons: item.addons || [],
        voidedQuantity: 0,
        isKitchenDone: false
      };
    });

    const newSubtotal = order.subTotal + subtotalDiff;
    const newTax = parseFloat((newSubtotal * 0.05).toFixed(2));
    const newGrandTotal = newSubtotal + newTax;

    const allItems = [...order.items, ...additionalItems];

    await orderRepo.updateById(orderId, {
      items: allItems,
      subTotal: newSubtotal,
      taxAmount: newTax,
      grandTotal: newGrandTotal,
      $push: {
        auditTrail: {
          action: "ADDON_KOT_SUBMITTED",
          userId: order.captainId.toString(),
          userName: order.captainName,
          timestamp: new Date(),
          notes: `Submitted incremental KOT: ${kotId}`
        }
      }
    });

    emitToRestaurant(order.restaurantId.toString(), "kot_sent", { orderId, kotId });
    emitToRestaurant(order.restaurantId.toString(), "order_updated", { _id: orderId });

    return newKot;
  }

  // VOID / CANCEL KOT PARTIAL ITEMS
  static async cancelKotItem(restaurantId: string, branchId: string, orderId: string, kotId: string, menuItemId: string, qty: number, reason: string, userId: string, userName: string) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new Error("Order not found.");

    const kot = await kotRepo.findOne({ restaurantId, branchId, kotId });
    if (!kot) throw new Error("KOT not found.");

    // Mark item voiding inside KOT
    let itemMatchInKOT = false;
    for (const it of kot.items) {
      if (it.menuItemId === menuItemId) {
        it.voidedQuantity = (it.voidedQuantity || 0) + qty;
        it.voidNotes = reason;
        itemMatchInKOT = true;
      }
    }
    if (!itemMatchInKOT) throw new Error("Menu item not found in specified KOT.");
    await kot.save();

    // Mark item voiding inside active Order
    let itemPrice = 0;
    for (const it of order.items) {
      if (it.menuItemId === menuItemId) {
        it.voidedQuantity = (it.voidedQuantity || 0) + qty;
        it.voidNotes = reason;
        if (it.quantity < it.voidedQuantity) {
          throw new Error("Cannot void more quantity than ordered.");
        }
        itemPrice = it.price;
      }
    }

    // Deduct cost of voided items from Order totals
    const costVoided = itemPrice * qty;
    const newSubtotal = Math.max(0, order.subTotal - costVoided);
    const newTax = parseFloat((newSubtotal * 0.05).toFixed(2));
    const newGrandTotal = newSubtotal + newTax;

    await orderRepo.updateById(orderId, {
      items: order.items,
      subTotal: newSubtotal,
      taxAmount: newTax,
      grandTotal: newGrandTotal,
      $push: {
        auditTrail: {
          action: "ITEM_VOID",
          userId,
          userName,
          timestamp: new Date(),
          notes: `Voided ${qty}x of item ${menuItemId}. Reason: ${reason}`
        }
      }
    });

    // Create Audit Log
    await AuditLog.create({
      restaurantId,
      branchId,
      action: "VOID_ITEM",
      details: `${userName} voided ${qty} of Item ${menuItemId} in Order ${orderId}`,
      userId,
      userName,
      metadata: { orderId, kotId, qty, reason }
    });

    emitToRestaurant(restaurantId, "order_updated", { _id: orderId });
    emitToRestaurant(restaurantId, "kot_voided", { kotId, menuItemId, qty });

    return { success: true };
  }

  // RE-SEND KOT TO KITCHEN PRINTER
  static async resendKOT(kotId: string) {
    const kot = await kotRepo.findOne({ kotId });
    if (!kot) throw new Error("KOT matching ID code not found.");

    const nextResendCount = (kot.resendCount || 0) + 1;
    const updated = await kotRepo.updateById(kot._id || kot.id, {
      resendCount: nextResendCount,
      status: "PRINTED"
    });

    emitToRestaurant(kot.restaurantId, "kot_sent", {
      orderId: kot.orderId,
      kotId: kot.kotId,
      isResend: true,
      resendCount: nextResendCount
    });

    return updated;
  }

  // 5. BILLING & INVOICING (POST /orders/:id/bill)
  static async generateBill(orderId: string, data: { discountAmount?: number, discountReason?: string, approvedBy?: string, serviceChargePercent?: number }) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new Error("Order matching ID not found.");

    const disc = data.discountAmount || 0;
    const discountAmount = disc > order.subTotal ? order.subTotal : disc;
    const subTotalWithDisc = order.subTotal - discountAmount;

    // Service charge calculation
    const scPercent = data.serviceChargePercent || 0;
    const serviceChargeAmount = parseFloat((subTotalWithDisc * (scPercent / 100)).toFixed(2));
    
    // Tax breakup & calculation
    const taxableAmount = subTotalWithDisc + serviceChargeAmount;
    const cgstAmount = parseFloat((taxableAmount * 0.025).toFixed(2));
    const sgstAmount = parseFloat((taxableAmount * 0.025).toFixed(2));
    const taxAmount = cgstAmount + sgstAmount;
    const grandTotal = taxableAmount + taxAmount;

    // Create unique bill number
    const billId = this.generateId("BILL");

    // Clear previous bills for this order to support bill regeneration
    await billRepo.deleteMany({ orderId });

    const bill = await billRepo.create({
      restaurantId: order.restaurantId.toString(),
      branchId: order.branchId.toString(),
      billId,
      orderId,
      subTotal: order.subTotal,
      serviceChargePercent: scPercent,
      serviceChargeAmount,
      taxBreakup: [
        { name: "CGST (2.5%)", rate: 2.5, amount: cgstAmount },
        { name: "SGST (2.5%)", rate: 2.5, amount: sgstAmount }
      ],
      taxAmount,
      discountAmount,
      discountReason: data.discountReason,
      discountApprovedBy: data.approvedBy,
      isComplimentary: false,
      grandTotal,
      duplicateCount: 0,
      isSettled: false,
      splitDetails: {
        isSplit: false,
        splitsCount: 1,
        amountPerSplit: grandTotal
      }
    });

    // Update order with exact billed financials & table status
    await orderRepo.updateById(orderId, {
      discountAmount,
      taxAmount,
      grandTotal,
      $push: {
        auditTrail: {
          action: "BILL_GENERATED",
          userId: data.approvedBy || "CASHIER",
          userName: data.approvedBy || "Cashier",
          timestamp: new Date(),
          notes: `Billed. Subtotal: ${order.subTotal}, Disc: ${discountAmount}, Grand: ${grandTotal}`
        }
      }
    });

    await tableRepo.updateById(order.tableId.toString(), {
      status: "BILLED"
    });

    emitToRestaurant(order.restaurantId.toString(), "bill_generated", { orderId, billId });
    emitToRestaurant(order.restaurantId.toString(), "table_status_changed", { tableId: order.tableId, status: "BILLED" });

    return bill;
  }

  // COMPLIMENTARY BILL EXEMPTION
  static async applyComplimentaryBill(restaurantId: string, branchId: string, orderId: string, reason: string, userId: string, userName: string) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new Error("Order not found.");

    const billId = this.generateId("BILL");
    await billRepo.deleteMany({ orderId });

    const bill = await billRepo.create({
      restaurantId,
      branchId,
      billId,
      orderId,
      subTotal: order.subTotal,
      taxBreakup: [],
      taxAmount: 0,
      discountAmount: order.subTotal,
      isComplimentary: true,
      complimentaryReason: reason,
      grandTotal: 0,
      isSettled: true
    });

    await orderRepo.updateById(orderId, {
      discountAmount: order.subTotal,
      taxAmount: 0,
      grandTotal: 0,
      status: "CLOSED",
      $push: {
        auditTrail: {
          action: "BILL_COMPLIMENTARY",
          userId,
          userName,
          timestamp: new Date(),
          notes: `Applied complimentary exemption. Reason: ${reason}`
        }
      }
    });

    // Reset Table
    await tableRepo.updateById(order.tableId.toString(), {
      status: "AVAILABLE",
      currentOrderId: null,
      occupiedSince: null
    });

    // Log the transaction
    await AuditLog.create({
      restaurantId,
      branchId,
      action: "COMPLIMENTARY_BILL",
      details: `${userName} set Order ${orderId} as Complimentary. Reason: ${reason}`,
      userId,
      userName,
      metadata: { orderId, subTotal: order.subTotal }
    });

    emitToRestaurant(restaurantId, "bill_generated", { orderId, billId });
    emitToRestaurant(restaurantId, "table_status_changed", { tableId: order.tableId, status: "AVAILABLE" });

    return bill;
  }

  // SUPPORT SPLIT BILLS
  static async splitBill(billId: string, splitsCount: number) {
    const bill = await billRepo.findOne({ billId });
    if (!bill) throw new Error("Bill matching ID not found.");
    if (splitsCount < 2) throw new Error("Splits count must be at least 2.");

    const amountPerSplit = parseFloat((bill.grandTotal / splitsCount).toFixed(2));

    return await billRepo.updateById(bill._id || bill.id, {
      splitDetails: {
        isSplit: true,
        splitsCount,
        amountPerSplit
      }
    });
  }

  // 6. SETTLE BILL & DEDUCT RAW INVENTORY ON SUCCESS (POST /orders/:id/settle)
  static async settleBill(orderId: string, data: {
    paymentMode: PaymentMode;
    amount: number;
    referenceId?: string;
    splitPayments?: any[];
  }) {
    const order = await orderRepo.findById(orderId);
    if (!order) throw new Error("Order matching ID not found.");

    const bill = await billRepo.findOne({ orderId });
    if (!bill) {
      throw new Error("No generated bill found for this order. Generate bill first.");
    }

    const settlement = await settlementRepo.create({
      restaurantId: order.restaurantId.toString(),
      branchId: order.branchId.toString(),
      billId: bill.billId,
      orderId,
      paymentMode: data.paymentMode,
      amount: data.amount,
      referenceId: data.referenceId || "",
      splitPayments: data.splitPayments || [],
      status: "SETTLED",
      createdUser: order.captainName
    });

    // Close order status
    await orderRepo.updateById(orderId, {
      status: "CLOSED",
      $push: {
        auditTrail: {
          action: "ORDER_CLOSED_SETTLED",
          userId: order.captainId.toString(),
          userName: order.captainName,
          timestamp: new Date(),
          notes: `Settled with mode: ${data.paymentMode}. Total: ${data.amount}`
        }
      }
    });

    // Set Bill to settled
    await billRepo.updateById(bill._id || bill.id, { isSettled: true });

    // Mark Table back to AVAILABLE
    await tableRepo.updateById(order.tableId.toString(), {
      status: "AVAILABLE",
      currentOrderId: null,
      occupiedSince: null
    });

    // 🌶️ ENTERPRISE INVENTORY MAPPING DEDUCTIONS ENGINE
    try {
      await this.processInventoryDeductions(order);
    } catch (invErr) {
      console.error("Critical Inventory Deduction Fail:", invErr);
    }

    emitToRestaurant(order.restaurantId.toString(), "settlement_done", { orderId, billId: bill.billId, settlement });
    emitToRestaurant(order.restaurantId.toString(), "table_status_changed", { tableId: order.tableId, status: "AVAILABLE" });

    return settlement;
  }

  // PROCESS INVENTORY DEDUCTIONS based on active Recipe maps
  static async processInventoryDeductions(order: any) {
    for (const item of order.items) {
      // Find Recipe mapping if exists
      const recipe = await (Recipe as any).findOne({
        restaurantId: order.restaurantId.toString(),
        branchId: order.branchId.toString(),
        menuItemId: item.menuItemId
      });

      if (!recipe) continue;

      const actQty = item.quantity - (item.voidedQuantity || 0);
      if (actQty <= 0) continue;

      for (const ingredientFormula of recipe.ingredients) {
        const totalDeductionQty = ingredientFormula.quantity * actQty;

        // Perform atomic deduction in stock Collection
        const stockRecord = await (InventoryStock as any).findOne({
          restaurantId: order.restaurantId.toString(),
          branchId: order.branchId.toString(),
          ingredientId: ingredientFormula.ingredientId
        });

        if (stockRecord) {
          stockRecord.currentQuantity = Math.max(0, stockRecord.currentQuantity - totalDeductionQty);
          await stockRecord.save();

          // Create stock Transaction record
          await StockTransaction.create({
            restaurantId: order.restaurantId.toString(),
            branchId: order.branchId.toString(),
            ingredientId: ingredientFormula.ingredientId,
            type: "DEDUCTION_SALE",
            quantity: totalDeductionQty,
            referenceId: order._id,
            notes: `Auto sale deduction for item ${item.name}`,
            timestamp: new Date()
          });
        }
      }
    }
  }

  // SETTLEMENT REVERSAL & REFUNDS TRACKING
  static async reverseSettlement(restaurantId: string, branchId: string, settlementId: string, reason: string, userId: string, userName: string) {
    const settle = await settlementRepo.findById(settlementId);
    if (!settle) throw new Error("Settlement match not found.");

    await settlementRepo.updateById(settlementId, {
      status: "REVERSED",
      reversalReason: reason,
      reversedAt: new Date()
    });

    // Reopen corresponding bill and order
    await billRepo.updateById(settle.billId, { isSettled: false });
    await orderRepo.updateById(settle.orderId, {
      status: "RUNNING",
      $push: {
        auditTrail: {
          action: "SETTLEMENT_REVERSED",
          userId,
          userName,
          timestamp: new Date(),
          notes: `Reversed settlement ${settlementId}. Reason: ${reason}`
        }
      }
    });

    // Put table back to BILLED
    const orderDoc = await orderRepo.findById(settle.orderId);
    if (orderDoc) {
      await tableRepo.updateById(orderDoc.tableId.toString(), {
        status: "BILLED",
        currentOrderId: orderDoc._id
      });
    }

    await AuditLog.create({
      restaurantId,
      branchId,
      action: "SETTLEMENT_REVERSED",
      details: `${userName} reversed settlement ID ${settlementId}. Reason: ${reason}`,
      userId,
      userName,
      metadata: { settlementId, billId: settle.billId }
    });

    emitToRestaurant(restaurantId, "settlement_reversed", { settlementId, orderId: settle.orderId });
    return { success: true };
  }

  // 7. KITCHEN DISPLAY SYSTEM (KDS) OPERATIONAL ENGINE
  static async getKdsQueue(restaurantId: string, branchId: string): Promise<any[]> {
    // Aggregates pending and preparing KOT queues
    return await kotRepo.find({
      restaurantId,
      branchId,
      status: { $in: ["PENDING", "PRINTED", "PREPARING", "READY"] }
    });
  }

  static async updateKdsStatus(restaurantId: string, branchId: string, kotId: string, status: KOTStatus, userId: string, userName: string) {
    const kot = await kotRepo.findOne({ restaurantId, branchId, kotId });
    if (!kot) throw new Error("Target KOT not found.");

    kot.status = status;
    await kot.save();

    // Notify updates on kitchen screens
    emitToRestaurant(restaurantId, "kds_updated", { kotId, status });
    return kot;
  }

  // 8. ENTERPRISE REPORTS POWERED BY AGGREGATION PIPELINES
  static async getSalesReport(restaurantId: string, branchId?: string, startDate?: string, endDate?: string) {
    const match: any = { status: "CLOSED", restaurantId: new mongoose.Types.ObjectId(restaurantId) };
    if (branchId) {
      match.branchId = new mongoose.Types.ObjectId(branchId);
    }
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    // Pipeline optimization
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalSubtotal: { $sum: "$subTotal" },
          totalTax: { $sum: "$taxAmount" },
          totalDiscount: { $sum: "$discountAmount" },
          totalSales: { $sum: "$grandTotal" },
          count: { $sum: 1 }
        }
      }
    ];

    const result = await orderRepo.aggregate(pipeline);
    return result[0] || { totalSubtotal: 0, totalTax: 0, totalDiscount: 0, totalSales: 0, count: 0 };
  }

  static async getCaptainPerformance(restaurantId: string, branchId?: string) {
    const match: any = { status: "CLOSED", restaurantId: new mongoose.Types.ObjectId(restaurantId) };
    if (branchId) match.branchId = new mongoose.Types.ObjectId(branchId);

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: "$captainName",
          ordersCount: { $sum: 1 },
          salesContributed: { $sum: "$grandTotal" }
        }
      },
      { $sort: { salesContributed: -1 } }
    ];

    return await orderRepo.aggregate(pipeline);
  }

  static async getItemSalesReport(restaurantId: string, branchId?: string) {
    const match: any = { status: "CLOSED", restaurantId: new mongoose.Types.ObjectId(restaurantId) };
    if (branchId) match.branchId = new mongoose.Types.ObjectId(branchId);

    const pipeline = [
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantitySold: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { quantitySold: -1 } }
    ];

    return await orderRepo.aggregate(pipeline);
  }

  // 10. ADVANCED ESC/POS PRINTER GENERATOR (GST invoicing aligned layouts, duplicate banners, QR support)
  static async getPrinterPayload(id: string, type: 'KOT' | 'BILL', isDuplicate: boolean = false) {
    if (type === 'KOT') {
      const kot = await kotRepo.findOne({ kotId: id });
      if (!kot) throw new Error("KOT matching ID code not found.");

      const isResend = kot.resendCount > 0 || isDuplicate;
      let text = `<C>=== ${isResend ? `DUPLICATE KOT (${kot.resendCount || 1})` : "KITCHEN ORDER TICKET"} ===\n`;
      text += `<C>KOT ID: ${kot.kotId}\n`;
      text += `<C>KOT TYPE: ${kot.kotType || 'NEW'}\n`;
      text += `<C>Order Ref: ${kot.orderId.toString().substring(kot.orderId.toString().length - 6)}\n`;
      text += `<L>Date: ${new Date(kot.createdAt).toLocaleString()}\n`;
      text += `--------------------------------\n`;
      text += `<L>Item Name                  Qty \n`;
      text += `--------------------------------\n`;
      
      for (const item of kot.items) {
        const netQty = item.quantity;
        if (netQty <= 0) continue;
        let nameLine = item.name;
        if (item.variantName && item.variantName !== "Regular") {
          nameLine += ` (${item.variantName})`;
        }
        const spacingNum = Math.max(2, 28 - nameLine.length);
        const spacing = " ".repeat(spacingNum);
        text += `<L>${nameLine}${spacing}${netQty}\n`;
        if (item.notes) {
          text += `<L>  * Style notes: ${item.notes}\n`;
        }
      }
      text += `--------------------------------\n`;
      text += `<C>KDS Operational Dispatch Engine\n\n\n`;
      return { payload: text };
    } else {
      const bill = await billRepo.findOne({ billId: id });
      if (!bill) throw new Error("Bill matching ID code not found.");

      const order = await orderRepo.findById(bill.orderId);
      const isRepl = bill.duplicateCount > 0 || isDuplicate;

      if (isDuplicate) {
        bill.duplicateCount += 1;
        await bill.save();
      }

      let text = "";
      if (isRepl) {
        text += `<C>================================\n`;
        text += `<C>     * DUPLICATE INVOICE *      \n`;
        text += `<C>     Watermark: Copy #${bill.duplicateCount}\n`;
        text += `<C>================================\n`;
      }

      text += `<C>*** RestoPro Enterprise OS ***\n`;
      text += `<C>Gourmet Culinary Systems Ltd.\n`;
      text += `<C>Bill Ref No: ${bill.billId}\n`;
      text += `<L>Table: ${order?.tableNumber || "N/A"}     Captain: ${order?.captainName || "POS"}\n`;
      text += `<L>GSTIN: 27AAAAA1111A1Z1\n`;
      text += `<L>Billing Date: ${new Date(bill.createdAt).toLocaleString()}\n`;
      text += `--------------------------------\n`;
      text += `<L>Item Description     Qty   Price\n`;
      text += `--------------------------------\n`;

      if (order && order.items) {
        for (const item of order.items) {
          const actQty = item.quantity - (item.voidedQuantity || 0);
          if (actQty <= 0) continue;
          const qtyStr = actQty.toString();
          const priceStr = (item.price * actQty).toFixed(2);
          const name = item.name.substring(0, 18);
          
          const pad = " ".repeat(Math.max(1, 19 - name.length));
          const padQty = " ".repeat(Math.max(1, 4 - qtyStr.length));
          text += `<L>${name}${pad}${qtyStr}${padQty}${priceStr}\n`;
        }
      }
      text += `--------------------------------\n`;
      text += `<R>Sub Total     : INR ${bill.subTotal.toFixed(2)}\n`;
      
      if (bill.discountAmount > 0) {
        text += `<R>Discount      : INR -${bill.discountAmount.toFixed(2)}\n`;
        if (bill.discountReason) {
          text += `<R> * Reason     : ${bill.discountReason}\n`;
        }
      }

      if (bill.serviceChargeAmount && bill.serviceChargeAmount > 0) {
        text += `<R>Srv Chg (${bill.serviceChargePercent}%): INR ${bill.serviceChargeAmount.toFixed(2)}\n`;
      }

      // TAX Breakup
      for (const t of bill.taxBreakup) {
        text += `<R>${t.name}   : INR ${t.amount.toFixed(2)}\n`;
      }

      text += `--------------------------------\n`;
      text += `<R>GRAND TOTAL   : INR ${bill.grandTotal.toFixed(2)}\n`;
      text += `--------------------------------\n`;
      text += `<C>[Scan to pay with UPI / Leave feedback]\n`;
      text += `<C>[QR Code: upi://pay?pa=restopro@ybl&am=${bill.grandTotal}]\n`;
      text += `--------------------------------\n`;
      text += `<C>Thank You! Built on RestoPro OS\n\n\n`;

      return { payload: text };
    }
  }
}
