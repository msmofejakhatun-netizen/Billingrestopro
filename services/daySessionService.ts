import { daySessionRepo } from "../repositories";

export class DaySessionService {
  static async openSession(restaurantId: string, branchId: string, openedBy: string, openingCash: number, notes?: string) {
    const activeSession = await daySessionRepo.findOne({ restaurantId, branchId, status: 'OPEN' });
    if (activeSession) {
      throw new Error("A day session is already currently active and open for this branch.");
    }

    return await daySessionRepo.create({
      restaurantId,
      branchId,
      openedBy,
      openingCash,
      notes,
      status: 'OPEN',
      openedAt: new Date()
    });
  }

  static async registerCashDrop(restaurantId: string, branchId: string, data: { amount: number, droppedBy: string, notes?: string }) {
    const session = await daySessionRepo.findOne({ restaurantId, branchId, status: 'OPEN' });
    if (!session) {
      throw new Error("No active day session open. Open a day first.");
    }

    const nextDrops = session.cashDrops || [];
    nextDrops.push({
      amount: data.amount,
      droppedBy: data.droppedBy,
      timestamp: new Date(),
      notes: data.notes || ""
    });

    return await daySessionRepo.updateById(session._id || session.id, {
      cashDrops: nextDrops
    });
  }

  static async closeSession(restaurantId: string, branchId: string, closedBy: string, closingCash: number, notes?: string) {
    const session = await daySessionRepo.findOne({ restaurantId, branchId, status: 'OPEN' });
    if (!session) {
      throw new Error("No open day session found to close.");
    }

    return await daySessionRepo.updateById(session._id || session.id, {
      status: 'CLOSED',
      closedBy,
      closingCash,
      notes,
      closedAt: new Date()
    });
  }

  static async getActiveSession(restaurantId: string, branchIdStr: string) {
    return await daySessionRepo.findOne({ restaurantId, branchId: branchIdStr, status: 'OPEN' });
  }

  static async getReconciliationSummary(restaurantId: string, branchIdStr: string) {
    const session = await daySessionRepo.findOne({ restaurantId, branchId: branchIdStr, status: 'OPEN' });
    if (!session) {
      return { status: "CLOSED", message: "Day session is currently closed." };
    }

    const dropsTotal = (session.cashDrops || []).reduce((acc: number, d: any) => acc + d.amount, 0);

    return {
      status: "OPEN",
      openedBy: session.openedBy,
      openedAt: session.openedAt,
      openingCash: session.openingCash,
      dropsTotal,
      currentExpectedCash: session.openingCash - dropsTotal,
      cashDrops: session.cashDrops
    };
  }
}
