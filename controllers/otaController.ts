import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { OtaService } from "../services/enterpriseServices";
import OTAUpdate from "../models/OTAUpdate";

export class OtaController {
  static async checkUpdate(req: AuthenticatedRequest, res: Response) {
    const currentVersionCodeStr = req.query.versionCode as string;
    const deviceType = (req.query.deviceType as any) || "CAPTAIN_APP";

    if (!currentVersionCodeStr) {
      return res.status(400).json({ success: false, error: "versionCode is a required query parameter." });
    }

    const currentVersionCode = parseInt(currentVersionCodeStr, 10);
    if (isNaN(currentVersionCode)) {
      return res.status(400).json({ success: false, error: "versionCode must be an integer score." });
    }

    try {
      const up = await OtaService.getLatestUpdate(currentVersionCode, deviceType);
      return res.json({ success: true, ...up });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Publish a new APK update metadata
  static async publishBuild(req: AuthenticatedRequest, res: Response) {
    const { versionCode, versionName, changelog, forceUpdate, apkUrl, minSupportedOS, targetDeviceType } = req.body;

    if (!versionCode || !versionName || !apkUrl) {
      return res.status(400).json({ success: false, error: "versionCode, versionName, and apkUrl are required." });
    }

    try {
      const ota = await OtaService.publishNewBuild({
        versionCode,
        versionName,
        changelog: changelog || [],
        forceUpdate: !!forceUpdate,
        apkUrl,
        minSupportedOS,
        targetDeviceType
      });
      return res.status(201).json({ success: true, message: "New build published.", build: ota });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  static async listBuilds(req: AuthenticatedRequest, res: Response) {
    try {
      const builds = await OTAUpdate.find().sort({ versionCode: -1 });
      return res.json({ success: true, builds });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
