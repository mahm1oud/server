import express, { Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import fs from "fs";
import path from "path";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertUserSignatureSchema } from "@shared/schema";
import { randomUUID } from "crypto";

const router = express.Router();

// إعداد تخزين الملفات المرفوعة
const uploadsDir = path.join(process.cwd(), "uploads");
const tempDir = path.join(process.cwd(), "temp");

// إنشاء مجلد التوقيعات إذا لم يكن موجوداً
const signaturesDir = path.join(uploadsDir, "signatures");
if (!fs.existsSync(signaturesDir)) {
  fs.mkdirSync(signaturesDir, { recursive: true });
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

// الحصول على توقيعات المستخدم
router.get("/", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    const userId = req.user.id;
    const type = req.query.type as string | undefined;
    
    const signatures = await storage.getUserSignatures(userId, type);
    res.json(signatures);
  } catch (error) {
    console.error("Error fetching user signatures:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب التوقيعات" });
  }
});

// الحصول على توقيع محدد
router.get("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف التوقيع غير صالح" });
    }
    
    const signature = await storage.getUserSignature(id);
    if (!signature) {
      return res.status(404).json({ error: "التوقيع غير موجود" });
    }
    
    // التحقق من ملكية التوقيع
    if (signature.userId !== req.user.id) {
      return res.status(403).json({ error: "غير مصرح لك بالوصول إلى هذا التوقيع" });
    }
    
    res.json(signature);
  } catch (error) {
    console.error("Error fetching user signature:", error);
    res.status(500).json({ error: "حدث خطأ أثناء جلب التوقيع" });
  }
});

// رفع توقيع جديد
router.post("/", isAuthenticated, upload.single('signature'), async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: "لم يتم توفير ملف التوقيع" });
    }
    
    const userId = req.user.id;
    const tempFilePath = req.file.path;
    
    // إنشاء اسم ملف فريد للتوقيع
    const signatureId = randomUUID();
    const ext = path.extname(req.file.originalname);
    const fileName = `user-signature-${userId}-${signatureId}${ext}`;
    const signaturePath = path.join(signaturesDir, fileName);
    
    // نقل الملف من المجلد المؤقت إلى مجلد التوقيعات
    fs.copyFileSync(tempFilePath, signaturePath);
    fs.unlinkSync(tempFilePath);
    
    // نموذج البيانات للتوقيع
    const dataSchema = z.object({
      name: z.string().min(1).default("توقيعي"),
      type: z.enum(["signature", "stamp"]).default("signature"),
    });
    
    let name = "توقيعي";
    let type = "signature";
    try {
      const parsedBody = dataSchema.parse(req.body);
      name = parsedBody.name;
      type = parsedBody.type;
    } catch (e) {
      // استخدام القيم الافتراضية في حالة الخطأ
    }
    
    // حفظ التوقيع في قاعدة البيانات
    const imageUrl = `/uploads/signatures/${fileName}`;
    const signatureData = insertUserSignatureSchema.parse({
      userId,
      name,
      imageUrl,
      type,
      isActive: true
    });
    
    const newSignature = await storage.createUserSignature(signatureData);
    res.status(201).json(newSignature);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "بيانات التوقيع غير صالحة", details: error.errors });
    }
    console.error("Error uploading user signature:", error);
    res.status(500).json({ error: "حدث خطأ أثناء رفع التوقيع" });
  }
});

// تعديل توقيع
router.patch("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف التوقيع غير صالح" });
    }
    
    // التحقق من وجود التوقيع وملكيته
    const existingSignature = await storage.getUserSignature(id);
    if (!existingSignature) {
      return res.status(404).json({ error: "التوقيع غير موجود" });
    }
    
    if (existingSignature.userId !== req.user.id) {
      return res.status(403).json({ error: "غير مصرح لك بتعديل هذا التوقيع" });
    }
    
    // تحديث التوقيع
    const signatureData = insertUserSignatureSchema.partial().parse(req.body);
    const updatedSignature = await storage.updateUserSignature(id, signatureData);
    
    res.json(updatedSignature);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "بيانات التوقيع غير صالحة", details: error.errors });
    }
    console.error("Error updating user signature:", error);
    res.status(500).json({ error: "حدث خطأ أثناء تحديث التوقيع" });
  }
});

// حذف توقيع
router.delete("/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "غير مصرح به" });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "معرف التوقيع غير صالح" });
    }
    
    // التحقق من وجود التوقيع وملكيته
    const existingSignature = await storage.getUserSignature(id);
    if (!existingSignature) {
      return res.status(404).json({ error: "التوقيع غير موجود" });
    }
    
    if (existingSignature.userId !== req.user.id) {
      return res.status(403).json({ error: "غير مصرح لك بحذف هذا التوقيع" });
    }
    
    // حذف الملف من القرص
    try {
      const filePath = path.join(process.cwd(), existingSignature.imageUrl.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting signature file:", err);
      // استمر في حذف التوقيع من قاعدة البيانات حتى لو فشل حذف الملف
    }
    
    // حذف التوقيع من قاعدة البيانات
    const success = await storage.deleteUserSignature(id);
    
    res.json({ success });
  } catch (error) {
    console.error("Error deleting user signature:", error);
    res.status(500).json({ error: "حدث خطأ أثناء حذف التوقيع" });
  }
});

export default router;