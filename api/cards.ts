import express, { Request, Response } from 'express';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';
import { isAuthenticated } from '../auth';

const router = express.Router();

// رفع صورة جديدة للبطاقة
router.post('/:id/update-image', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { imageData } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ message: "لا توجد بيانات صورة مرسلة" });
    }
    
    // جلب البطاقة
    const card = await storage.getCard(parseInt(id));
    if (!card) {
      return res.status(404).json({ message: "البطاقة غير موجودة" });
    }
    
    // تحقق من الصلاحيات إذا كان المستخدم مسجل
    if (req.isAuthenticated() && card.userId && req.user.id !== card.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "غير مصرح لك بتعديل هذه البطاقة" });
    }
    
    // معالجة بيانات base64
    const base64Data = imageData.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // إنشاء اسم ملف فريد
    const timestamp = Date.now();
    const filename = `card_${id}_${timestamp}.png`;
    const uploadPath = path.join(process.cwd(), 'uploads', filename);
    
    // تأكد من وجود مجلد التحميل
    await fs.promises.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
    
    // كتابة الملف
    await fs.promises.writeFile(uploadPath, buffer);
    
    // محاولة حذف الصورة القديمة
    if (card.imageUrl) {
      const oldImagePath = path.join(process.cwd(), card.imageUrl.replace(/^\//, ''));
      try {
        await fs.promises.access(oldImagePath, fs.constants.F_OK);
        await fs.promises.unlink(oldImagePath);
      } catch (error) {
        console.warn(`Old image at ${oldImagePath} could not be deleted:`, error);
      }
    }
    
    // تحديث البطاقة مع عنوان URL الجديد للصورة
    const imageUrl = `/uploads/${filename}`;
    await storage.updateCard(card.id, { imageUrl });
    
    res.json({ 
      success: true, 
      imageUrl, 
      message: "تم تحديث صورة البطاقة بنجاح" 
    });
  } catch (error) {
    console.error("Error updating card image:", error);
    res.status(500).json({ message: "حدث خطأ أثناء تحديث صورة البطاقة" });
  }
});

export default router;