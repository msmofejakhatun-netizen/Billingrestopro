import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { DeviceService } from "../services/enterpriseServices";
import Device from "../models/Device";

export class DeviceController {
  static async register(req: AuthenticatedRequest, res: Response) {
    const { restaurantId, branchId } = req.user!;
    const { deviceId, deviceName, deviceModel, osVersion, captainId, assignedCaptainName } = req.body;

    if (!deviceId || !deviceName || !deviceModel || !osVersion) {
      return res.status(400).json({
        success: false,
        error: "deviceId, deviceName, deviceModel, and osVersion are required parameters."
      });
    }

    try {
      const dev = await DeviceService.registerDevice({
        deviceId,
        restaurantId,
        branchId,
        deviceName,
        deviceModel,
        osVersion,
        captainId,
        assignedCaptainName
      });
      return res.status(201).json({ success: true, message: "Device registered in enterprise register", device: dev });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async heartbeat(req: AuthenticatedRequest, res: Response) {
    const { deviceId } = req.body;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: "deviceId is a required heartbeat field" });
    }

    try {
      const dev = await DeviceService.updateHeartbeat(deviceId);
      if (!dev) {
        return res.status(404).json({ success: false, error: "Device registration profile not found." });
      }
      return res.json({ success: true, status: dev.status, authTokenRotationVersion: dev.authTokenRotationVersion });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async list(req: AuthenticatedRequest, res: Response) {
    const { branchId } = req.user!;
    try {
      const list = await (Device as any).find({ branchId });
      return res.json({ success: true, devices: list });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response) {
    const { deviceId } = req.params;
    try {
      const done = await DeviceService.remoteLogout(deviceId);
      if (!done) {
        return res.status(404).json({ success: false, error: "Device not found" });
      }
      return res.json({ success: true, message: "Device session revoked. Token credentials invalidated." });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async updatePrinterMapping(req: AuthenticatedRequest, res: Response) {
    const { deviceId } = req.params;
    const { printerMapping } = req.body;

    if (!printerMapping) {
      return res.status(400).json({ success: false, error: "printerMapping configuration is required" });
    }

    try {
      const dev = await (Device as any).findOne({ deviceId });
      if (!dev) {
        return res.status(404).json({ success: false, error: "Device not found" });
      }
      dev.printerMapping = {
        ...dev.printerMapping,
        ...printerMapping
      };
      await dev.save();
      return res.json({ success: true, message: "Device printer mappings synchronized.", device: dev });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
