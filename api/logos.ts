import express, { Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertUserLogoSchema, insertTemplateLogoSchema } from "@shared/schema";
import { randomUUID } from "crypto";

const router = express.Router();

// إعداد تخزين الملفات المرفوعة
const uploadsDir = path.join(process.cwd(), "uploads");
const tempDir = path.join(process.cwd(), "temp");

// إنشاء مجلد الشعارات إذا لم يكن موجوداً
const logosDir = path.join(uploadsDir, "logos");
if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

// إعداد تحميل الملفات
const multerStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, tempDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('نوع الملف غير مدعوم. فقط ملفات الصور مدعومة.'));
  }
};

const upload = multer({ 
  storage: multerStorage, 
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// =======================
// شعارات المستخدم - User Logos
// =======================

// الحصول على شعارات المستخدم
router.get("/user", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    const userId = req.user.id;
    const logos = await storage.getUserLogos(userId);
    res.json(logos);
  } catch (error) {
    console.error("Error fetching user logos:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب شعارات المستخدم" });
  }
});

// الحصول على شعار محدد للمستخدم
router.get("/user/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف الشعار غير صالح" });
    }
    
    const logo = await storage.getUserLogo(id);
    if (!logo) {
      return res.status(404).json({ error: "الشعار غير موجود" });
    }
    
    // التحقق من ملكية الشعار
    if (logo.userId !== req.user.id) {
      return res.status(403).json({ error: "غير مصرح لك بالوصول إلى هذا الشعار" });
    }
    
    res.json(logo);
  } catch (error) {
    console.error("Error fetching user logo:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب الشعار" });
  }
});

// رفع شعار جديد للمستخدم
router.post("/user", isAuthenticated, upload.single('logo'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم توفير ملف الشعار" });
    }
    
    const userId = req.user.id;
    const tempFilePath = req.file.path;
    
    // إنشاء اسم ملف فريد للشعار
    const logoId = randomUUID();
    const ext = path.extname(req.file.originalname);
    const fileName = `user-logo-${userId}-${logoId}${ext}`;
    const logoPath = path.join(logosDir, fileName);
    
    // نقل الملف من المجلد المؤقت إلى مجلد الشعارات
    fs.copyFileSync(tempFilePath, logoPath);
    fs.unlinkSync(tempFilePath);
    
    // نموذج الاسم والوصف للشعار
    const nameSchema = z.object({
      name: z.string().min(1).default("شعار"),
    });
    
    let name = "شعار";
    try {
      const parsedBody = nameSchema.parse(req.body);
      name = parsedBody.name;
    } catch (e) {
      // استخدام القيمة الافتراضية في حالة الخطأ
    }
    
    // حفظ الشعار في قاعدة البيانات
    const imageUrl = `/uploads/logos/${fileName}`;
    const logoData = insertUserLogoSchema.parse({
      userId,
      name,
      imageUrl,
      isActive: true
    });
    
    const newLogo = await storage.createUserLogo(logoData);
    res.status(201).json(newLogo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "بيانات الشعار غير صالحة", details: error.errors });
    }
    console.error("Error uploading user logo:", error);
    res.status(500).json({ error: "حدث خطأ أثناء رفع الشعار" });
  }
});

// تعديل شعار المستخدم
router.patch("/user/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف الشعار غير صالح" });
    }
    
    // التحقق من وجود الشعار وملكيته
    const existingLogo = await storage.getUserLogo(id);
    if (!existingLogo) {
      return res.status(404).json({ error: "الشعار غير موجود" });
    }
    
    if (existingLogo.userId !== req.user.id) {
      return res.status(403).json({ error: "غير مصرح لك بتعديل هذا الشعار" });
    }
    
    // تحديث الشعار
    const logoData = insertUserLogoSchema.partial().parse(req.body);
    const updatedLogo = await storage.updateUserLogo(id, logoData);
    
    res.json(updatedLogo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "بيانات الشعار غير صالحة", details: error.errors });
    }
    console.error("Error updating user logo:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تحديث الشعار" });
  }
});

// حذف شعار المستخدم
router.delete("/user/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف الشعار غير صالح" });
    }
    
    // التحقق من وجود الشعار وملكيته
    const existingLogo = await storage.getUserLogo(id);
    if (!existingLogo) {
      return res.status(404).json({ error: "الشعار غير موجود" });
    }
    
    if (existingLogo.userId !== req.user.id) {
      return res.status(403).json({ error: "غير مصرح لك بحذف هذا الشعار" });
    }
    
    // حذف الملف من القرص
    try {
      const filePath = path.join(process.cwd(), existingLogo.imageUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting logo file:", err);
      // استمر في حذف الشعار من قاعدة البيانات حتى لو فشل حذف الملف
    }
    
    // حذف الشعار من قاعدة البيانات
    const success = await storage.deleteUserLogo(id);
    
    res.json({ success });
  } catch (error) {
    console.error("Error deleting user logo:", error);
    res.status(500).json({ error: "حدث خطأ أثناء حذف الشعار" });
  }
});

// =======================
// شعارات القوالب - Template Logos
// =======================

// الحصول على شعارات القالب
router.get("/template/:templateId", async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: "معرف القالب غير صالح" });
    }
    
    const logos = await storage.getTemplateLogos(templateId);
    res.json(logos);
  } catch (error) {
    console.error("Error fetching template logos:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب شعارات القالب" });
  }
});

// الحصول على شعار محدد للقالب
router.get("/template/logo/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف الشعار غير صالح" });
    }
    
    const logo = await storage.getTemplateLogo(id);
    if (!logo) {
      return res.status(404).json({ error: "الشعار غير موجود" });
    }
    
    res.json(logo);
  } catch (error) {
    console.error("Error fetching template logo:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب الشعار" });
  }
});

export default router;