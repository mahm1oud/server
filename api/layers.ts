import express, { Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../auth";
import { insertLayerSchema } from "@shared/schema";

const router = express.Router();

// الحصول على كل الطبقات لقالب معين
router.get("/template/:templateId", async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: "معرف القالب غير صالح" });
    }
    
    const layers = await storage.getLayers(templateId);
    res.json(layers);
  } catch (error) {
    console.error("Error fetching layers:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب الطبقات" });
  }
});

// الحصول على طبقة محددة
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف الطبقة غير صالح" });
    }
    
    const layer = await storage.getLayer(id);
    if (!layer) {
      return res.status(404).json({ error: "الطبقة غير موجودة" });
    }
    
    res.json(layer);
  } catch (error) {
    console.error("Error fetching layer:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب الطبقة" });
  }
});

// إنشاء طبقة جديدة (مسؤول فقط)
router.post("/", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const layerData = insertLayerSchema.parse(req.body);
    const newLayer = await storage.createLayer(layerData);
    res.status(201).json(newLayer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "بيانات الطبقة غير صالحة", details: error.errors });
    }
    console.error("Error creating layer:", error);
    res.status(500).json({ error: "حدث خطأ أثناء إنشاء الطبقة" });
  }
});

// تعديل طبقة (مسؤول فقط)
router.patch("/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف الطبقة غير صالح" });
    }
    
    // اعتماد جزئي لحقول الطبقة
    const layerData = insertLayerSchema.partial().parse(req.body);
    
    const updatedLayer = await storage.updateLayer(id, layerData);
    if (!updatedLayer) {
      return res.status(404).json({ error: "الطبقة غير موجودة" });
    }
    
    res.json(updatedLayer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "بيانات الطبقة غير صالحة", details: error.errors });
    }
    console.error("Error updating layer:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تحديث الطبقة" });
  }
});

// حذف طبقة (مسؤول فقط)
router.delete("/:id", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف الطبقة غير صالح" });
    }
    
    const success = await storage.deleteLayer(id);
    if (!success) {
      return res.status(404).json({ error: "الطبقة غير موجودة" });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting layer:", error);
    res.status(500).json({ error: "حدث خطأ أثناء حذف الطبقة" });
  }
});

// إعادة ترتيب الطبقات (مسؤول فقط)
router.post("/reorder", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      templateId: z.number(),
      layerIds: z.array(z.number())
    });
    
    const { templateId, layerIds } = schema.parse(req.body);
    
    const success = await storage.reorderLayers(templateId, layerIds);
    if (!success) {
      return res.status(500).json({ error: "فشل في إعادة ترتيب الطبقات" });
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "بيانات الترتيب غير صالحة", details: error.errors });
    }
    console.error("Error reordering layers:", error);
    res.status(500).json({ error: "حدث خطأ أثناء إعادة ترتيب الطبقات" });
  }
});

export default router;