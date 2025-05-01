/**
 * مولد الصور الديناميكي للبطاقات والشهادات
 * الإصدار المحسن 2.0 - أبريل 2025
 * 
 * تحسينات محرك توليد الصور للحصول على تطابق 100% بين المعاينة والصورة النهائية:
 * 
 * 1. تحسين دقة موضع الحقول:
 *    - استخدام تقريب الأرقام بشكل متسق (Math.round) لضمان موضع دقيق
 *    - تحسين معالجة الموضع النسبي وتحويله إلى بكسل بنفس الطريقة المستخدمة في المعاينة
 *    - توحيد صيغة الإحداثيات بين المعاينة والصورة النهائية
 * 
 * 2. تحسين معالجة الخطوط:
 *    - استخدام نفس صيغة تعريف الخطوط المستخدمة في المعاينة
 *    - تقريب أحجام الخطوط لضمان التطابق
 *    - تحسين معالجة الخطوط العربية والإنجليزية
 *  
 * 3. تحسين معالجة النص:
 *    - استخدام نفس معامل تباعد الأسطر (lineHeightFactor = 1.3)
 *    - تحسين خوارزمية لف النص (wrapText) لتطابق المعاينة
 *    - توحيد المحاذاة والتباعد بين السطور
 * 
 * 4. تحسين معالجة الظلال والتأثيرات:
 *    - معالجة متسقة لظلال النص
 *    - تحسين التعامل مع ألوان النص وخاصة اللون الأسود
 * 
 * كل هذه التحسينات تضمن تطابق 100% بين معاينة حقول القالب والصورة النهائية المولدة
 * بغض النظر عن اختلاف الجودة أو إعدادات التصدير.
 */

import type { Template } from "@shared/schema";
import path from "path";
import fs from "fs";
import { createCanvas, loadImage, registerFont } from "canvas";
import { formatDate, formatTime } from "./lib/utils";
import crypto from "crypto";
import sharp from "sharp";

/**
 * تحسين الصورة باستخدام مكتبة Sharp بشكل أكثر كفاءة
 * هذه الوظيفة تأخذ بيانات الصورة وتحسنها وتضغطها بناءً على إعدادات الجودة
 * تم تحسين الأداء بتطبيق إعدادات مخصصة حسب الجودة المطلوبة
 * 
 * @param buffer بيانات الصورة
 * @param outputPath مسار حفظ الصورة
 * @param format تنسيق الصورة
 * @param quality جودة الصورة
 * @param outputQuality نسبة جودة الصورة
 * @returns مسار الصورة المحسنة
 */
async function optimizeAndSaveImage(
  buffer: Buffer,
  outputPath: string,
  format: string,
  quality: 'preview' | 'download' | 'low' | 'medium' | 'high',
  outputQuality: number
): Promise<string> {
  try {
    console.time('imageOptimization');
    
    // تحسين الصورة بناء على نوع الجودة المطلوبة
    let sharpInstance = sharp(buffer);
    
    // تطبيق التعديلات المشتركة لجميع الصور (حسب نوع الجودة)
    // نطبق فقط إعدادات ضغط الجودة بدون تغيير الحجم لضمان تطابق المعاينة والتنزيل 100%
    if (quality === 'preview') {
      // لا نقوم بتغيير حجم صورة المعاينة، فقط نضبط جودتها للتحميل السريع
      // لا نطبق تغيير الحجم لضمان تطابق المعاينة مع صور التنزيل
    } else if (quality === 'low') {
      // جودة منخفضة: بدون تغيير الحجم أيضاً
    }
    
    if (format === "image/jpeg") {
      await sharpInstance
        .jpeg({ 
          quality: Math.round(outputQuality * 100),
          progressive: true,
          optimizeScans: true,
          trellisQuantisation: quality !== 'preview', // لا تستخدم في المعاينة لتسريع العملية
          overshootDeringing: quality !== 'preview', // لا تستخدم في المعاينة لتسريع العملية
          optimizeCoding: true,
          force: true
        })
        .toFile(outputPath);
    } else {
      await sharpInstance
        .png({ 
          compressionLevel: quality === 'preview' ? 9 : quality === 'low' ? 7 : quality === 'medium' ? 5 : 3,
          adaptiveFiltering: quality !== 'preview', // تعطيل ترشيح تكيفي في المعاينة للسرعة
          palette: quality === 'preview', // استخدام لوحة ألوان فقط في المعاينة لتقليل الحجم
          quality: quality === 'preview' ? 80 : 100, // خفض الجودة لمعاينة الصورة
          force: true
        })
        .toFile(outputPath);
    }
    
    console.timeEnd('imageOptimization');
    console.log(`Image optimized and saved to ${outputPath} using Sharp with ${quality} quality`);
    return outputPath;
  } catch (sharpError) {
    console.error("Error optimizing image with Sharp:", sharpError);
    
    try {
      // محاولة استخدام إعدادات أبسط إذا فشلت الإعدادات المتقدمة
      console.log("Trying simple optimization as fallback...");
      await sharp(buffer)
        .resize(quality === 'preview' ? 800 : 1200)
        .toFile(outputPath);
      
      console.log(`Fallback optimization successful for ${outputPath}`);
      return outputPath;
    } catch (fallbackError) {
      console.error("Fallback optimization failed:", fallbackError);
      // فولباك إلى طريقة الحفظ التقليدية
      fs.writeFileSync(outputPath, buffer);
      console.log(`Last resort fallback: Image saved to ${outputPath} using traditional method`);
      return outputPath;
    }
  }
}

// Define font fallbacks for Arabic text
// We'll use system fonts that support Arabic characters
const ARABIC_FONTS = {
  // Primary font choices
  CAIRO: 'Cairo, Arial, sans-serif',
  CAIRO_BOLD: 'Cairo, Arial Bold, sans-serif',
  TAJAWAL: 'Tajawal, Tahoma, sans-serif',
  TAJAWAL_BOLD: 'Tajawal, Tahoma, sans-serif',
  AMIRI: 'Amiri, Times New Roman, serif',
  AMIRI_BOLD: 'Amiri, Times New Roman, serif',
  
  // Fallbacks that are commonly available on most systems
  SANS: 'Arial, Tahoma, sans-serif',
  SANS_BOLD: 'Arial Bold, Tahoma Bold, sans-serif',
  SERIF: 'Times New Roman, serif',
  SERIF_BOLD: 'Times New Roman Bold, serif',
};

// Attempt to register fonts with absolute paths, but prepare to use system fonts if it fails
try {
  const fontsDir = path.resolve(process.cwd(), 'fonts');
  console.log("Fonts directory:", fontsDir);
  
  // Check if font files exist
  console.log("Checking font files exist:");
  
  const cairoRegular = path.join(fontsDir, 'Cairo-Regular.ttf');
  const cairoBold = path.join(fontsDir, 'Cairo-Bold.ttf');
  const tajawalRegular = path.join(fontsDir, 'Tajawal-Regular.ttf');
  
  console.log(`Cairo Regular: ${fs.existsSync(cairoRegular)} Size: ${fs.existsSync(cairoRegular) ? fs.statSync(cairoRegular).size : 'Not found'}`);
  console.log(`Cairo Bold: ${fs.existsSync(cairoBold)} Size: ${fs.existsSync(cairoBold) ? fs.statSync(cairoBold).size : 'Not found'}`);
  console.log(`Tajawal Regular: ${fs.existsSync(tajawalRegular)} Size: ${fs.existsSync(tajawalRegular) ? fs.statSync(tajawalRegular).size : 'Not found'}`);
  
  // Register the Cairo font family
  if (fs.existsSync(cairoRegular)) {
    registerFont(cairoRegular, { family: 'Cairo' });
    console.log("Cairo Regular font registered successfully");
  }
  
  if (fs.existsSync(cairoBold)) {
    registerFont(cairoBold, { family: 'Cairo', weight: 'bold' });
    console.log("Cairo Bold font registered successfully");
  }
  
  // Register the Tajawal font family
  if (fs.existsSync(tajawalRegular)) {
    registerFont(tajawalRegular, { family: 'Tajawal' });
    console.log("Tajawal Regular font registered successfully");
  }
  
  const tajawalBold = path.join(fontsDir, 'Tajawal-Bold.ttf');
  if (fs.existsSync(tajawalBold)) {
    registerFont(tajawalBold, { family: 'Tajawal', weight: 'bold' });
    console.log("Tajawal Bold font registered successfully");
  }
  
  // Register the Amiri font family (elegant serif Arabic font)
  const amiriRegular = path.join(fontsDir, 'Amiri-Regular.ttf');
  if (fs.existsSync(amiriRegular)) {
    registerFont(amiriRegular, { family: 'Amiri' });
    console.log("Amiri Regular font registered successfully");
  }
  
  const amiriBold = path.join(fontsDir, 'Amiri-Bold.ttf');
  if (fs.existsSync(amiriBold)) {
    registerFont(amiriBold, { family: 'Amiri', weight: 'bold' });
    console.log("Amiri Bold font registered successfully");
  }
  
  console.log("All Arabic fonts registered successfully");
} catch (e: any) {
  console.warn("Error in font registration process:", e.message || e);
}

/**
 * Generate a card image with the provided template and form data
 * Optimized for improved performance, especially in preview mode
 * 
 * @param template The template to use for the card
 * @param formData The user input data to overlay on the template
 * @param quality Quality setting for the generated image ('preview', 'download', 'low', 'medium', 'high')
 * @returns Path to the generated image
 */
export async function generateCardImage(
  template: Template, 
  formData: any, 
  quality: 'preview' | 'download' | 'low' | 'medium' | 'high' = 'medium'
): Promise<string> {
  // Performance optimization - skip generating full image for preview if it already exists
  // This will use cached images if available
  if (quality === 'preview') {
    const hash = crypto.createHash('md5').update(JSON.stringify(formData) + template.id).digest('hex');
    const cacheFile = path.join(process.cwd(), "uploads", `${hash}_preview.jpg`);
    
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000); // 5 minutes in milliseconds
      
      // Use cache if file exists and is less than 5 minutes old
      if (stats.mtimeMs > fiveMinutesAgo) {
        console.log("Using cached preview image:", cacheFile);
        return cacheFile;
      }
    }
  }
  try {
    console.log("Starting card image generation for template:", template.id, template.title);
    console.log("Form data type:", typeof formData, "is array?", Array.isArray(formData));
    
    // Define the output path variable at the beginning of the function
    let outputPath: string;
    
    // معالجة حقول الصور في البيانات المدخلة
    if (formData) {
      const processedFormData = { ...formData };
      
      // معالجة مسارات الصور المرفقة والتأكد من أنها مسارات مطلقة
      for (const key in processedFormData) {
        const value = processedFormData[key];
        
        if (typeof value === 'string') {
          // إذا كان المسار في مجلد temp، نستبدله بـ uploads
          if (value.includes('/temp/')) {
            // أولاً، نحصل على اسم الملف الذي بعد temp
            const fileName = path.basename(value);
            
            // نعيد بناء المسار باستخدام مجلد uploads
            const relativePath = `/uploads/${fileName}`;
            processedFormData[key] = path.join(process.cwd(), relativePath.substring(1));
            
            console.log(`Converting temp path ${value} to uploads path: ${processedFormData[key]}`);
          }
          // التعامل مع الصور من مجلد generated
          else if (value.includes('/generated/') && !value.includes('/uploads/generated/')) {
            // تصحيح المسار ليشير إلى مجلد uploads/generated
            const fileName = path.basename(value);
            const relativePath = `/uploads/generated/${fileName}`;
            processedFormData[key] = path.join(process.cwd(), relativePath.substring(1));
            
            console.log(`Converting generated path ${value} to uploads/generated path: ${processedFormData[key]}`);
          }
          // تحقق مما إذا كانت القيمة مسار صورة نسبي
          else if (value.startsWith('/uploads/')) {
            // تحويل المسار النسبي إلى مسار مطلق
            processedFormData[key] = path.join(process.cwd(), value.substring(1));
            console.log(`Converted image path: ${value} to absolute path: ${processedFormData[key]}`);
          }
        }
      }
      
      // استخدام البيانات المعالجة
      formData = processedFormData;
    }
    
    // استخراج إعدادات القالب أو استخدام قيم افتراضية
    let templateSettings: Record<string, any> = {};
    
    if (template.settings) {
      // تأكد من أن الإعدادات في الصيغة المناسبة
      if (typeof template.settings === 'string') {
        try {
          templateSettings = JSON.parse(template.settings);
        } catch (e) {
          console.error("Error parsing template settings:", e);
          templateSettings = {};
        }
      } else if (typeof template.settings === 'object') {
        templateSettings = template.settings as Record<string, any>;
      }
    }
    
    console.log("Template settings:", templateSettings);
    
    // استخراج الاتجاه من إعدادات القالب (أفقي أو عمودي)
    const orientation = templateSettings.orientation || 'portrait';
    console.log(`Using orientation: ${orientation}`);
    
    // استخراج إعدادات حجم الورق العالمية
    const paperSize = templateSettings.paperSize || 'custom';
    let paperWidth = parseFloat(String(templateSettings.paperWidth)) || 0;
    let paperHeight = parseFloat(String(templateSettings.paperHeight)) || 0;
    const paperUnit = templateSettings.paperUnit || 'mm';
    
    // استخراج حجم الصورة المخصص (طريقة قديمة)
    const useCustomSize = templateSettings.useCustomSize === true;
    const customWidth = useCustomSize && templateSettings.customWidth ? 
      parseInt(String(templateSettings.customWidth)) : 0;
    const customHeight = useCustomSize && templateSettings.customHeight ? 
      parseInt(String(templateSettings.customHeight)) : 0;
    
    console.log(`Paper size: ${paperSize}, dimensions: ${paperWidth}x${paperHeight} ${paperUnit}`);
    console.log(`Custom dimensions: ${useCustomSize ? 'enabled' : 'disabled'}, width=${customWidth}, height=${customHeight}`);
    
    // تحديد أبعاد الرسم بناءً على إعدادات الجودة وإعدادات القالب
    let width, height;
    
    // معامل التحويل لوحدات القياس المختلفة إلى بكسل
    // نفترض أن الدقة 300dpi للتحويل من وحدات الطباعة إلى بكسل
    const DPI = 300;
    const INCH_TO_PX = DPI;
    const MM_TO_PX = DPI / 25.4;
    const CM_TO_PX = DPI / 2.54;
    
    // استخدام أبعاد حجم الورق إذا تم تحديده
    if (paperSize !== 'custom' && paperSize !== '') {
      console.log(`Using standard paper size: ${paperSize}`);
      
      // تحويل أبعاد الورق إلى بكسل حسب وحدة القياس
      let pixelWidth = 0;
      let pixelHeight = 0;
      
      if (paperWidth > 0 && paperHeight > 0) {
        if (paperUnit === 'mm') {
          pixelWidth = Math.round(paperWidth * MM_TO_PX);
          pixelHeight = Math.round(paperHeight * MM_TO_PX);
        } else if (paperUnit === 'cm') {
          pixelWidth = Math.round(paperWidth * CM_TO_PX);
          pixelHeight = Math.round(paperHeight * CM_TO_PX);
        } else if (paperUnit === 'inch') {
          pixelWidth = Math.round(paperWidth * INCH_TO_PX);
          pixelHeight = Math.round(paperHeight * INCH_TO_PX);
        }
        
        // تدوير الأبعاد إذا كان الاتجاه أفقي
        if (orientation === 'landscape') {
          width = pixelHeight;
          height = pixelWidth;
        } else {
          width = pixelWidth;
          height = pixelHeight;
        }
        
        console.log(`Paper size converted to pixels: ${width}x${height} (${paperWidth}x${paperHeight} ${paperUnit})`);
      }
    }
    // استخدام الأبعاد المخصصة القديمة إذا تم تحديدها وكانت صالحة ولم يتم تحديد حجم ورق
    else if (useCustomSize && customWidth > 0 && customHeight > 0) {
      console.log(`Using custom dimensions from template settings: ${customWidth}x${customHeight}`);
      width = customWidth;
      height = customHeight;
    } else {
      // لضمان تطابق المعاينة والتنزيل بنسبة 100%، نستخدم نفس أبعاد الصورة دائمًا
      // المتغير الوحيد هو مستوى جودة الصورة (ضغط الصورة)
      if (orientation === 'landscape') {
        // أبعاد أفقية - نستخدم أبعاد موحدة
        width = 1680; // استخدام نفس الأبعاد لكل الجودات لضمان تطابق النصوص 100%
        height = 1200;
      } else {
        // أبعاد عمودية (الافتراضي) - نستخدم أبعاد موحدة
        width = 1200; // استخدام نفس الأبعاد لكل الجودات لضمان تطابق النصوص 100%
        height = 1680;
      }
    }
    
    console.log(`Canvas dimensions set to: ${width}x${height}, orientation: ${orientation}, quality: ${quality}`);
    
    // Create canvas with higher resolution
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    
    // Set high-quality rendering
    ctx.imageSmoothingEnabled = true;
    // Note: imageSmoothingQuality might not be available in all canvas implementations
    (ctx as any).imageSmoothingQuality = 'high';
    
    // Validate template image URL
    if (!template.imageUrl) {
      throw new Error("Template image URL is missing");
    }
    
    // Check if the image URL is relative or absolute
    let imageUrl;
    
    try {
      // إذا كان مسار الصورة يبدأ بـ http، استخدمه كما هو
      if (template.imageUrl.startsWith('http')) {
        imageUrl = template.imageUrl;
      } 
      // إذا كان المسار يبدأ بـ / (مسار نسبي)
      else if (template.imageUrl.startsWith('/')) {
        // جرب أولاً من الجذر (بدون تغيير)
        imageUrl = `${process.env.BASE_URL || 'http://localhost:5000'}${template.imageUrl}`;
        
        // طريقة بديلة - تحقق إذا كان الملف موجوداً على القرص مباشرة
        const localPath = path.join(process.cwd(), template.imageUrl);
        if (fs.existsSync(localPath)) {
          console.log(`Template image found at local path: ${localPath}`);
          imageUrl = localPath;
        }
      } 
      // لأي نوع آخر من المسارات
      else {
        imageUrl = template.imageUrl;
        // تحقق إذا كان الملف موجوداً على القرص مباشرة
        if (!fs.existsSync(imageUrl)) {
          // جرب كملف بمسار نسبي من جذر التطبيق
          const localPath = path.join(process.cwd(), template.imageUrl);
          if (fs.existsSync(localPath)) {
            imageUrl = localPath;
          }
        }
      }
      
      console.log(`Attempting to load template image from ${imageUrl}`);
    } catch (urlError) {
      console.error("Failed to construct image URL:", urlError);
      throw new Error("Invalid template image URL");
    }
    
    // إعداد خلفية بيضاء كبديل في حالة فشل تحميل الصورة
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    let image;
    try {
      // محاولة تحميل الصورة مع إعادة المحاولة مع مسارات مختلفة
      try {
        image = await loadImage(imageUrl);
        console.log("Template image loaded successfully");
      } catch (initialError) {
        console.error("Initial attempt to load template image failed:", initialError);
        
        // محاولة إضافية - إذا لم ينجح المسار الأصلي، جرب مسارات بديلة
        const alternativePaths = [
          path.join(process.cwd(), 'uploads', path.basename(template.imageUrl)),
          path.join(process.cwd(), 'client', 'static', path.basename(template.imageUrl)),
          path.join(process.cwd(), template.imageUrl.replace(/^\//, ''))
        ];
        
        let loaded = false;
        for (const altPath of alternativePaths) {
          if (fs.existsSync(altPath)) {
            try {
              console.log(`Trying alternative path: ${altPath}`);
              image = await loadImage(altPath);
              console.log(`Template image loaded successfully from alternative path: ${altPath}`);
              loaded = true;
              break;
            } catch (altError) {
              console.error(`Failed to load from alternative path ${altPath}:`, altError);
            }
          }
        }
        
        if (!loaded) {
          throw initialError; // إعادة رمي الخطأ الأصلي إذا لم تنجح أي من المحاولات البديلة
        }
      }
    } catch (imageError) {
      console.error("All attempts to load template image failed:", imageError);
      // استمر مع خلفية بيضاء بدلاً من الفشل
      console.log("Using white background as fallback for template image");
    }
    
    // Get template aspect ratio settings or default to preserved (null)
    const aspectRatio = (templateSettings.aspectRatio as string) || null;
    
    // Calculate drawing dimensions while preserving aspect ratio
    let drawWidth = width;
    let drawHeight = height;
    let offsetX = 0;
    let offsetY = 0;
    
    if (aspectRatio === 'original' && image) {
      // Maintain original image aspect ratio
      const origRatio = image.width / image.height;
      
      // Determine if we need to adjust width or height
      if (orientation === 'portrait') {
        // Portrait mode - fit to width
        drawWidth = width;
        drawHeight = width / origRatio;
        
        // Center vertically if needed
        if (drawHeight < height) {
          offsetY = (height - drawHeight) / 2;
        } else if (drawHeight > height) {
          // Early generation and return for specific crop case
          // Set quality and format based on options
          let outputQuality: number;
          let imageFormat: string = "image/png";
          
          // Set quality based on parameter
          switch(quality) {
            case 'preview':
              outputQuality = 0.6; // Lower quality for preview (<1MB)
              imageFormat = "image/jpeg";
              break;
            case 'download':
              outputQuality = 0.9; // Higher quality for download (up to 2MB)
              break;
            case 'low':
              outputQuality = 0.4;
              imageFormat = "image/jpeg";
              break;
            case 'medium':
              outputQuality = 0.7;
              break;
            case 'high':
              outputQuality = 0.9;
              break;
            default:
              outputQuality = 0.8; // Default quality
          }
          
          // Generate unique filename with appropriate extension
          const extension = imageFormat === "image/jpeg" ? "jpg" : "png";
          const filename = `${crypto.randomBytes(16).toString("hex")}_${quality}.${extension}`;
          outputPath = path.join(process.cwd(), "uploads", filename);
          
          // Crop excess height (centering the visible portion)
          const cropOffset = (drawHeight - height) / 2;
          ctx.save();
          ctx.rect(0, 0, width, height);
          ctx.clip();
          ctx.drawImage(image as any, 0, -cropOffset, drawWidth, drawHeight);
          ctx.restore();
          
          // Generate buffer based on format with appropriate settings
          let buffer;
          if (imageFormat === "image/jpeg") {
            buffer = canvas.toBuffer("image/jpeg", { 
              quality: outputQuality,
              progressive: true
            });
          } else {
            buffer = canvas.toBuffer("image/png", {
              compressionLevel: quality === 'download' ? 0 : 4, // Lower compression level for download
              filters: 0x1F, // Use all PNG filters for best quality 
              resolution: quality === 'preview' ? 150 : 300, // Higher DPI for download
              palette: undefined, // No palette to avoid color reduction
            });
          }
          
          fs.writeFileSync(outputPath, buffer);
          return outputPath;
        }
      } else {
        // Landscape mode - fit to height
        drawHeight = height;
        drawWidth = height * origRatio;
        
        // Center horizontally if needed
        if (drawWidth < width) {
          offsetX = (width - drawWidth) / 2;
        } else if (drawWidth > width) {
          // Early generation and return for specific crop case
          // Set quality and format based on options
          let outputQuality: number;
          let imageFormat: string = "image/png";
          
          // Set quality based on parameter
          switch(quality) {
            case 'preview':
              outputQuality = 0.6; // Lower quality for preview (<1MB)
              imageFormat = "image/jpeg";
              break;
            case 'download':
              outputQuality = 0.9; // Higher quality for download (up to 2MB)
              break;
            case 'low':
              outputQuality = 0.4;
              imageFormat = "image/jpeg";
              break;
            case 'medium':
              outputQuality = 0.7;
              break;
            case 'high':
              outputQuality = 0.9;
              break;
            default:
              outputQuality = 0.8; // Default quality
          }
          
          // Generate unique filename with appropriate extension
          const extension = imageFormat === "image/jpeg" ? "jpg" : "png";
          const filename = `${crypto.randomBytes(16).toString("hex")}_${quality}.${extension}`;
          outputPath = path.join(process.cwd(), "uploads", filename);

          // Crop excess width (centering the visible portion)
          const cropOffset = (drawWidth - width) / 2;
          ctx.save();
          ctx.rect(0, 0, width, height);
          ctx.clip();
          ctx.drawImage(image as any, -cropOffset, 0, drawWidth, drawHeight);
          ctx.restore();
          
          // Generate buffer based on format with appropriate settings
          let buffer;
          if (imageFormat === "image/jpeg") {
            buffer = canvas.toBuffer("image/jpeg", { 
              quality: outputQuality,
              progressive: true
            });
          } else {
            buffer = canvas.toBuffer("image/png", {
              compressionLevel: quality === 'download' ? 0 : 4, // Lower compression level for download
              filters: 0x1F, // Use all PNG filters for best quality 
              resolution: quality === 'preview' ? 150 : 300, // Higher DPI for download
              palette: undefined, // No palette to avoid color reduction
            });
          }
          
          fs.writeFileSync(outputPath, buffer);
          return outputPath;
        }
      }
    } else if (aspectRatio === 'square') {
      // Force square aspect ratio
      const size = Math.min(width, height);
      drawWidth = size;
      drawHeight = size;
      
      // Center the square
      offsetX = (width - size) / 2;
      offsetY = (height - size) / 2;
    } else if (aspectRatio === 'custom' && templateSettings.customRatio) {
      // Apply custom aspect ratio
      const [customWidth, customHeight] = (templateSettings.customRatio as string).split(':').map(Number);
      const customRatio = customWidth / customHeight;
      
      if (orientation === 'portrait') {
        drawWidth = width;
        drawHeight = width / customRatio;
        
        // Center vertically if needed
        if (drawHeight < height) {
          offsetY = (height - drawHeight) / 2;
        } else if (drawHeight > height) {
          // Crop excess height
          offsetY = -(drawHeight - height) / 2;
          drawHeight = height;
        }
      } else {
        drawHeight = height;
        drawWidth = height * customRatio;
        
        // Center horizontally if needed
        if (drawWidth < width) {
          offsetX = (width - drawWidth) / 2;
        } else if (drawWidth > width) {
          // Crop excess width
          offsetX = -(drawWidth - width) / 2;
          drawWidth = width;
        }
      }
    }
    
    // تطبيق الاتجاه على الصورة عند رسمها
    if (image) {
      console.log(`Drawing image with dimensions: ${drawWidth}x${drawHeight}, offset: ${offsetX},${offsetY}, orientation: ${orientation}`);
      
      if (orientation === 'landscape') {
        // حالة الاتجاه الأفقي
        // تحقق مما إذا كانت الصورة أصلًا عمودية وتحتاج إلى تدوير
        const isPortraitImage = image.height > image.width;
        
        if (isPortraitImage) {
          console.log("Image is portrait but template orientation is landscape, applying rotation...");
          
          // حفظ السياق الحالي للكانفاس
          ctx.save();
          
          // تطبيق التدوير 90 درجة في اتجاه عقارب الساعة
          // نقل نقطة الأصل إلى وسط الكانفاس
          ctx.translate(width / 2, height / 2);
          ctx.rotate(Math.PI / 2);
          
          // حساب الأبعاد الجديدة بعد التدوير
          // عند التدوير 90 درجة، يتم تبديل العرض والارتفاع
          const rotatedWidth = drawHeight;
          const rotatedHeight = drawWidth;
          
          // رسم الصورة مع مراعاة التدوير (يجب أن تكون الإحداثيات سالبة للمركز)
          ctx.drawImage(image, -rotatedWidth / 2, -rotatedHeight / 2, rotatedWidth, rotatedHeight);
          
          // استعادة السياق الأصلي
          ctx.restore();
        } else {
          // الصورة بالفعل أفقية، رسمها كما هي
          console.log("Image is already in landscape orientation, drawing normally");
          ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
        }
      } else {
        // حالة الاتجاه العمودي (الافتراضي)
        // تحقق مما إذا كانت الصورة أصلًا أفقية وتحتاج إلى تدوير
        const isLandscapeImage = image.width > image.height;
        
        if (isLandscapeImage) {
          console.log("Image is landscape but template orientation is portrait, applying rotation...");
          
          // حفظ السياق الحالي للكانفاس
          ctx.save();
          
          // تطبيق التدوير -90 درجة (عكس اتجاه عقارب الساعة)
          // نقل نقطة الأصل إلى وسط الكانفاس
          ctx.translate(width / 2, height / 2);
          ctx.rotate(-Math.PI / 2);
          
          // حساب الأبعاد الجديدة بعد التدوير
          // عند التدوير -90 درجة، يتم تبديل العرض والارتفاع
          const rotatedWidth = drawHeight;
          const rotatedHeight = drawWidth;
          
          // رسم الصورة مع مراعاة التدوير (يجب أن تكون الإحداثيات سالبة للمركز)
          ctx.drawImage(image, -rotatedWidth / 2, -rotatedHeight / 2, rotatedWidth, rotatedHeight);
          
          // استعادة السياق الأصلي
          ctx.restore();
        } else {
          // الصورة بالفعل عمودية، رسمها كما هي
          console.log("Image is already in portrait orientation, drawing normally");
          ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
        }
      }
    } else {
      console.warn("No image to draw, using white background");
    }
    
    // Add semi-transparent overlay for better text visibility if needed
    if (!templateSettings.noOverlay) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(0, 0, width, height);
    }
    
    // Default text properties (will be overridden by field settings)
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";  // اللون الافتراضي أبيض
    ctx.direction = "rtl";
    ctx.textBaseline = "middle";
    
    // إعداد الظل للنص وفقًا لإعدادات القالب
    if (templateSettings.textShadow !== false) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 5;
    } else {
      ctx.shadowBlur = 0;  // إيقاف ظل النص إذا تم تعطيله في الإعدادات
    }
    
    // إصلاح مشكلة عرض ألوان النص
    const fixTextColor = templateSettings.fixTextColor !== false;
    
    // طباعة معلومات الحقول المستخدمة
    console.log("Form Data:", formData);
    
    // جلب بيانات حقول القالب
    try {
      // جلب حقول القالب من قاعدة البيانات (إلا إذا كانت موجودة بالفعل)
      let fields = [];
      
      // Safely access template fields property if it exists
      const templateFields = (template as any).templateFields;
      
      if (Array.isArray(templateFields) && templateFields.length > 0) {
        fields = templateFields;
        console.log(`Using ${fields.length} template fields provided with the template object`);
      } else {
        // جلب حقول القالب من قاعدة البيانات
        const { db } = await import('./db');
        const { templateFields } = await import('@shared/schema');
        
        // استعلام الحقول للقالب
        fields = await db.query.templateFields.findMany({
          where: (templateFields, { eq }) => eq(templateFields.templateId, template.id)
        });
        
        console.log(`Fetched ${fields.length} template fields from database for template ID ${template.id}`);
      }
      
      // الحقول المُدخلة - مع الإعدادات المخصصة لكل حقل
      if (formData && fields.length > 0) {
        console.log(`Applying custom field positions and styles for ${fields.length} fields`);
        drawCustomFieldsWithStyles(ctx, formData, width, height, fields);
      } else if (formData) {
        console.log(`No custom fields found, using default layout`);
        drawCustomFields(ctx, formData, width, height);
      }
    } catch (error) {
      console.warn(`Error fetching template fields: ${error}. Using default field styles.`);
      
      // استخدام الطريقة الافتراضية إذا فشل استعلام الحقول
      if (formData) {
        drawCustomFields(ctx, formData, width, height);
      }
    }
    
    // Set quality and format based on options
    let outputQuality: number;
    let imageFormat: string = "image/png";
    
    // Set quality based on parameter
    switch(quality) {
      case 'preview':
        outputQuality = 0.3; // Very low quality for fast preview (<500KB)
        imageFormat = "image/jpeg";
        break;
      case 'download':
        outputQuality = 0.9; // Higher quality for download (up to 2MB)
        break;
      case 'low':
        outputQuality = 0.4;
        imageFormat = "image/jpeg";
        break;
      case 'medium':
        outputQuality = 0.7;
        imageFormat = "image/jpeg"; // Use JPEG for medium quality too for better performance
        break;
      case 'high':
        outputQuality = 0.9;
        break;
      default:
        outputQuality = 0.5; // Default lower quality
        imageFormat = "image/jpeg";
    }
    
    // Generate unique filename with appropriate extension
    const extension = imageFormat === "image/jpeg" ? "jpg" : "png";
    const filename = `${crypto.randomBytes(16).toString("hex")}_${quality}.${extension}`;
    outputPath = path.join(process.cwd(), "uploads", filename);
    
    // Generate buffer based on format with appropriate settings
    let buffer;
    if (imageFormat === "image/jpeg") {
      buffer = canvas.toBuffer("image/jpeg", { 
        quality: outputQuality,
        progressive: true
      });
    } else {
      buffer = canvas.toBuffer("image/png", {
        compressionLevel: quality === 'download' ? 0 : 4, // Lower compression level for download
        filters: 0x1F, // Use all PNG filters for best quality 
        resolution: quality === 'preview' ? 150 : 300, // Higher DPI for download
        palette: undefined, // No palette to avoid color reduction
      });
    }
    
    // استخدام معالجة Sharp لضغط وتحسين الصورة
    try {
      console.log(`Using Sharp to optimize the image with quality setting: ${quality}, format: ${imageFormat}`);
      await optimizeAndSaveImage(buffer, outputPath, imageFormat as string, quality, outputQuality);
    } catch (optimizationError) {
      console.error("Failed to optimize with Sharp, falling back to direct save:", optimizationError);
      fs.writeFileSync(outputPath, buffer);
    }
    
    return outputPath;
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("فشل في إنشاء الصورة");
  }
}

// دالة جديدة لرسم الحقول المخصصة مع أنماط مخصصة
/**
 * رسم الحقول المخصصة بالتنسيقات - محسّن لمطابقة 100% مع المعاينة
 * تحديث إصدار 2.0 - تمت مراجعة الخوارزميات لضمان دقة مطابقة للمعاينة
 */
/**
 * دالة محسنة لرسم الحقول المخصصة على الصورة
 * مع تطبيق تنسيقات وأنماط مخصصة لكل حقل
 * وضمان تطابق 100% بين المعاينة والصورة النهائية
 */
async function drawCustomFieldsWithStyles(
  ctx: any,
  formData: Record<string, any>,
  width: number,
  height: number,
  fields: any[],
  clientBaseWidth = 800 // العرض الافتراضي الذي كان في الواجهة
) {
  // الحصول على أسماء الحقول
  const fieldNames = Object.keys(formData);
  if (fieldNames.length === 0) return;
  
  console.log(`Drawing ${fieldNames.length} custom fields on image with custom styles (v3.0)`);
  
  // حساب معامل قياس الخط لتعويض الفرق بين حجم الكانفاس في الواجهة والسيرفر
  const scaleFactor = width / clientBaseWidth;
  console.log(`Font scale factor: ${scaleFactor} (Server canvas: ${width}px, Client preview: ${clientBaseWidth}px)`);

  // إنشاء خريطة للحقول للوصول السريع
  const fieldMap = new Map(fields.map(field => [field.name, field]));
  
  // تحسين معالجة النص بضبط baseline للتطابق مع المعاينة
  ctx.textBaseline = 'middle';
  
  // معلمات لتحديد موضع النص للحقول التي ليس لها موضع محدد
  const startY = height * 0.2;
  let spaceBetweenFields = height * 0.1;
  if (fieldNames.length > 5) {
    spaceBetweenFields = height * 0.7 / fieldNames.length;
  }
  
  // تتبع الموضع المستخدم لكل حقل لتجنب التداخل
  const usedPositions: { x: number, y: number, height: number, width: number }[] = [];
  
  // ترتيب الحقول حسب طبقة العرض (رقم أصغر = طبقة أسفل)
  const sortedFieldNames = [...fieldNames].sort((a, b) => {
    const fieldA = fieldMap.get(a);
    const fieldB = fieldMap.get(b);
    const layerA = fieldA?.style?.layer || 1;
    const layerB = fieldB?.style?.layer || 1;
    return layerA - layerB;
  });
  
  console.log(`Sorted fields by layer: `, sortedFieldNames.map(name => {
    const field = fieldMap.get(name);
    return `${name} (layer: ${field?.style?.layer || 1})`;
  }));
  
  // رسم كل حقل حسب ترتيب الطبقات
  for (let i = 0; i < sortedFieldNames.length; i++) {
    const fieldName = sortedFieldNames[i];
    const index = i;
    const value = formData[fieldName];
    if (!value) continue;
    
    // الحصول على إعدادات الحقل
    const field = fieldMap.get(fieldName);
    if (!field) continue;
    
    // حفظ حالة السياق الحالية
    ctx.save();
    
    // طباعة معلومات الطبقة
    console.log(`Drawing field ${fieldName} in layer ${field.style?.layer || 1}`);
    
    // التحقق مما إذا كان الحقل من نوع صورة أو إذا كانت القيمة تشير إلى مسار صورة
    const isImageField = field.type === 'image'; 
    const isImagePath = typeof value === 'string' && (
      value.startsWith('/uploads/') || 
      value.startsWith(process.cwd()) || 
      value.startsWith('data:image/')
    );
    
    if (isImageField || isImagePath) {
      try {
        console.log(`Processing image field: ${fieldName} with value: ${typeof value === 'string' ? (value.substring(0, 100) + '...') : typeof value}`);
        
        let imagePath = '';
        
        if (typeof value === 'string') {
          // تحديد المسار المطلق للصورة
          if (value.startsWith('/uploads/')) {
            imagePath = path.join(process.cwd(), value.substring(1));
            console.log(`Converted image path: ${value} to absolute path: ${imagePath}`);
          } else if (value.startsWith(process.cwd())) {
            imagePath = value;
          } else if (value.startsWith('data:image/')) {
            // معالجة الصور المضمنة (Data URLs)
            // حفظ الصورة المضمنة مؤقتًا إلى ملف
            const tempFilename = crypto.randomBytes(16).toString('hex') + '.png';
            const tempFilePath = path.join(process.cwd(), 'temp', tempFilename);
            
            // استخراج البيانات من Data URL
            const base64Data = value.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // حفظ الصورة إلى ملف مؤقت
            try {
              fs.writeFileSync(tempFilePath, buffer);
              imagePath = tempFilePath;
              console.log(`Saved embedded image to temporary file: ${tempFilePath}`);
            } catch (writeErr) {
              console.error(`Error saving embedded image to file: ${writeErr}`);
            }
          }
        }
        
        // التأكد من وجود مسار صورة صالح
        if (imagePath && fs.existsSync(imagePath)) {
          const style = field.style || {};
          
          try {
            // حساب موضع الصورة من إعدادات الحقل
            let posX = width / 2; // افتراضي في المنتصف
            let posY = startY + index * spaceBetweenFields;
            
            if (field.position) {
              // استخدام الموضع المخصص من إعدادات الحقل
              if (field.position.x !== undefined) {
                const xPercent = parseFloat(Math.max(0, Math.min(100, field.position.x)).toFixed(2));
                posX = Math.round((xPercent / 100) * width);
              }
              
              if (field.position.y !== undefined) {
                const yPercent = parseFloat(Math.max(0, Math.min(100, field.position.y)).toFixed(2));
                posY = Math.round((yPercent / 100) * height);
              }
            }
            
            // تحميل الصورة
            const img = await loadImage(imagePath);
            
            // الحصول على أبعاد الصورة للحفاظ على نسبة العرض للارتفاع
            const imgWidth = img.width;
            const imgHeight = img.height;
            
            // استخدام نفس منطق تحديد حجم الصور المستخدم في واجهة المستخدم (KonvaImageGenerator)
            const maxWidth = style.imageMaxWidth || width / 4; // ربع عرض القالب
            const maxHeight = style.imageMaxHeight || height / 4; // ربع ارتفاع القالب
            
            // حساب الأبعاد مع الحفاظ على نسبة العرض إلى الارتفاع
            const aspectRatio = imgWidth / imgHeight;
            let displayWidth, displayHeight;
            
            // الحفاظ على نسبة العرض إلى الارتفاع مع تطبيق الحد الأقصى للأبعاد
            if (aspectRatio > 1) {
              // صورة أفقية (landscape)
              displayWidth = Math.min(maxWidth, imgWidth);
              displayHeight = displayWidth / aspectRatio;
              
              // تأكد من أن الارتفاع ليس أكبر من الحد الأقصى
              if (displayHeight > maxHeight) {
                displayHeight = maxHeight;
                displayWidth = displayHeight * aspectRatio;
              }
            } else {
              // صورة رأسية (portrait)
              displayHeight = Math.min(maxHeight, imgHeight);
              displayWidth = displayHeight * aspectRatio;
              
              // تأكد من أن العرض ليس أكبر من الحد الأقصى
              if (displayWidth > maxWidth) {
                displayWidth = maxWidth;
                displayHeight = displayWidth / aspectRatio;
              }
            }
            
            console.log(`Image dimensions for ${fieldName}: Original: ${imgWidth}x${imgHeight}, Display: ${displayWidth}x${displayHeight}, AspectRatio: ${aspectRatio}`);
            
            
            // تطبيق تحويلات الصورة (إذا تم توفيرها)
            if (style.imageOffset) {
              posX += (style.imageOffset.x || 0) * scaleFactor;
              posY += (style.imageOffset.y || 0) * scaleFactor;
            }
            
            // تطبيق الدوران (إذا تم توفيره)
            if (style.imageRotation) {
              const rotation = style.imageRotation * Math.PI / 180; // تحويل من درجات إلى راديان
              ctx.translate(posX, posY);
              ctx.rotate(rotation);
              ctx.translate(-posX, -posY);
            }
            
            // تطبيق الشفافية (إذا تم توفيرها)
            if (style.imageOpacity !== undefined) {
              ctx.globalAlpha = style.imageOpacity;
            }
            
            // ضبط موضع الصورة بناءً على محاذاة النص
            let imgX = posX;
            if (ctx.textAlign === 'center' || style.align === 'center') {
              imgX = posX - (displayWidth / 2);
            } else if (ctx.textAlign === 'right' || style.align === 'right') {
              imgX = posX - displayWidth;
            }
            
            // رسم إطار للصورة (إذا تم تمكينه)
            if (style.imageBorder) {
              const borderWidth = style.imageBorderWidth || 2;
              const borderColor = style.imageBorderColor || '#000000';
              const borderRadius = style.imageRounded ? Math.min(displayWidth, displayHeight) / 4 : 0;
              
              ctx.strokeStyle = borderColor;
              ctx.lineWidth = borderWidth;
              
              if (borderRadius > 0) {
                // رسم مستطيل بحواف مستديرة
                ctx.beginPath();
                ctx.moveTo(imgX + borderRadius, posY - (displayHeight / 2));
                ctx.lineTo(imgX + displayWidth - borderRadius, posY - (displayHeight / 2));
                ctx.quadraticCurveTo(imgX + displayWidth, posY - (displayHeight / 2), imgX + displayWidth, posY - (displayHeight / 2) + borderRadius);
                ctx.lineTo(imgX + displayWidth, posY + (displayHeight / 2) - borderRadius);
                ctx.quadraticCurveTo(imgX + displayWidth, posY + (displayHeight / 2), imgX + displayWidth - borderRadius, posY + (displayHeight / 2));
                ctx.lineTo(imgX + borderRadius, posY + (displayHeight / 2));
                ctx.quadraticCurveTo(imgX, posY + (displayHeight / 2), imgX, posY + (displayHeight / 2) - borderRadius);
                ctx.lineTo(imgX, posY - (displayHeight / 2) + borderRadius);
                ctx.quadraticCurveTo(imgX, posY - (displayHeight / 2), imgX + borderRadius, posY - (displayHeight / 2));
                ctx.closePath();
                ctx.stroke();
              } else {
                // رسم مستطيل عادي
                ctx.strokeRect(imgX, posY - (displayHeight / 2), displayWidth, displayHeight);
              }
            }
            
            // تطبيق ظل للصورة (إذا تم تمكينه)
            if (style.imageShadow?.enabled) {
              ctx.shadowColor = style.imageShadow.color || 'rgba(0,0,0,0.5)';
              ctx.shadowBlur = style.imageShadow.blur || 10;
              ctx.shadowOffsetX = style.imageShadow.offsetX || 5;
              ctx.shadowOffsetY = style.imageShadow.offsetY || 5;
            }
            
            // رسم الصورة على القالب
            ctx.drawImage(img, imgX, posY - (displayHeight / 2), displayWidth, displayHeight);
            
            // إيقاف الظل بعد الرسم
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            console.log(`Image drawn for field ${fieldName} at position (${imgX}, ${posY}) with dimensions ${displayWidth}x${displayHeight}`);
          } catch (err) {
            console.error(`Failed to load or draw image for field ${fieldName}: ${err}`);
          }
        } else {
          if (imagePath) {
            console.error(`Image file not found: ${imagePath}`);
          } else {
            console.error(`Invalid image path for field ${fieldName}`);
          }
        }
      } catch (err) {
        console.error(`Error processing image field ${fieldName}: ${err}`);
      } finally {
        // استعادة حالة السياق واتنقال للحقل التالي
        ctx.restore();
      }
      
      continue;
    }
    
    // معالجة حقول النص
    const text = String(value);
    
    const style = field.style || {};
    
    // استخراج خصائص النص مع تطبيق معامل القياس
    const originalFontSize = Math.round(style.fontSize || 24);
    const fontSize = Math.round(originalFontSize * scaleFactor);
    const fontFamily = style.fontFamily || 'Cairo';
    const fontWeight = style.fontWeight || 'normal';
    
    console.log(`Field ${fieldName} font size: original=${originalFontSize}px, scaled=${fontSize}px (scale=${scaleFactor})`);
    
    // إنشاء سلسلة الخط
    let fontString = '';
    if (fontFamily === 'Amiri') {
      fontString = fontWeight === 'bold' 
        ? `bold ${fontSize}px ${ARABIC_FONTS.AMIRI_BOLD}`
        : `${fontSize}px ${ARABIC_FONTS.AMIRI}`;
    } else if (fontFamily === 'Tajawal') {
      fontString = fontWeight === 'bold'
        ? `bold ${fontSize}px ${ARABIC_FONTS.TAJAWAL_BOLD}`
        : `${fontSize}px ${ARABIC_FONTS.TAJAWAL}`;
    } else {
      fontString = fontWeight === 'bold'
        ? `bold ${fontSize}px ${ARABIC_FONTS.CAIRO_BOLD}`
        : `${fontSize}px ${ARABIC_FONTS.CAIRO}`;
    }
    
    // تطبيق إعدادات النص
    ctx.font = fontString;
    ctx.fillStyle = style.color || '#000000';
    ctx.textAlign = (style.align || 'center') as CanvasTextAlign;
    
    console.log(`Field ${fieldName} font: ${fontString}`);
    console.log(`Field ${fieldName} color: ${style.color || '#000000'}`);
    
    if (style.align) {
      console.log(`Setting text alignment for ${fieldName} to: ${style.align}`);
    }
    
    // حساب موضع النص
    let posX = width / 2; // افتراضي في المنتصف
    let posY: number;
    
    if (field.position) {
      // استخدام الموضع المخصص من إعدادات الحقل
      if (field.position.x !== undefined) {
        const xPercent = parseFloat(Math.max(0, Math.min(100, field.position.x)).toFixed(2));
        posX = Math.round((xPercent / 100) * width);
        console.log(`Field ${fieldName} position X: ${xPercent}% => ${posX}px (optimized)`);
      }
      
      if (field.position.y !== undefined) {
        const yPercent = parseFloat(Math.max(0, Math.min(100, field.position.y)).toFixed(2));
        posY = Math.round((yPercent / 100) * height);
        console.log(`Field ${fieldName} position Y: ${yPercent}% => ${posY}px (optimized)`);
      } else {
        // إذا لم يكن لدينا موضع عمودي، نستخدم الموضع التلقائي
        posY = findAvailableYPosition(usedPositions, posX, fontSize, startY, spaceBetweenFields, index);
      }
    } else {
      // استخدام موضع تلقائي إذا لم يكن هناك موضع محدد
      posY = findAvailableYPosition(usedPositions, posX, fontSize, startY, spaceBetweenFields, index);
    }
    
    // إعدادات ظل النص إن وجدت
    if (style.textShadow?.enabled) {
      ctx.shadowColor = style.textShadow.color || 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = style.textShadow.blur || 3;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    // معالجة النص متعدد الأسطر (إذا كان النص طويل)
    const maxWidth = style.maxWidth 
      ? Math.round((style.maxWidth / 100) * width) 
      : Math.round(width - 100);
    
    // لف النص إلى أسطر متعددة إذا لزم الأمر
    const lineHeightFactor = 1.3;
    const lines = wrapText(ctx, text, maxWidth, fontSize, lineHeightFactor);
    
    // حساب ارتفاع كل سطر والنص الكامل
    const lineHeight = Math.round(fontSize * lineHeightFactor);
    const totalTextHeight = Math.round(lineHeight * lines.length);
    
    // ضبط موضع البداية حسب المحاذاة العمودية
    let currentY = posY;
    
    if (style.verticalPosition === 'middle') {
      currentY = Math.round(posY - (totalTextHeight / 2) + (lineHeight / 2));
    } else if (style.verticalPosition === 'bottom') {
      currentY = Math.round(posY - totalTextHeight);
    }
    
    // رسم كل سطر من النص
    for (const line of lines) {
      ctx.fillText(line, Math.round(posX), Math.round(currentY));
      currentY += lineHeight;
    }
    
    // تسجيل الموضع المستخدم لهذا الحقل لتجنب التداخل
    const textWidth = Math.round(ctx.measureText(text).width);
    usedPositions.push({
      x: posX - (textWidth / 2),
      y: posY - (fontSize / 2),
      width: textWidth,
      height: totalTextHeight
    });
    
    // استعادة حالة السياق السابقة
    ctx.restore();
  }
}

// دالة لإيجاد موضع Y مناسب لا يتداخل مع الحقول السابقة
function findAvailableYPosition(
  usedPositions: Array<{ x: number, y: number, height: number, width: number }>,
  posX: number,
  fontSize: number,
  startY: number,
  spaceBetweenFields: number,
  index: number
): number {
  // البداية بالموضع الافتراضي
  let posY = startY + (index * spaceBetweenFields);
  
  // البحث عن موضع لا يتداخل مع الحقول السابقة
  let overlap = true;
  let attempts = 0;
  const maxAttempts = 10; // لتجنب العمليات الطويلة
  
  while (overlap && attempts < maxAttempts) {
    overlap = false;
    
    // مراجعة المواضع المستخدمة
    for (const usedPos of usedPositions) {
      // حساب المسافة الرأسية بين الموضع الحالي والموضع المستخدم
      const verticalDistance = Math.abs(posY - (usedPos.y + usedPos.height / 2));
      
      // إذا كان الموضع قريب جدًا من حقل موجود، زيادة الموضع لأسفل
      if (verticalDistance < fontSize * 1.2) {
        posY += fontSize * 1.5; // زيادة المسافة لتجنب التداخل
        overlap = true;
        break;
      }
    }
    
    attempts++;
  }
  
  return posY;
}

// دالة لرسم الحقول المخصصة بتخطيط افتراضي
async function drawCustomFields(ctx: any, formData: any, width: number, height: number) {
  // Get template settings if available
  const fixTextColor = true; // Default to true for backward compatibility
  // الحصول على أسماء الحقول
  const fieldNames = Object.keys(formData);
  if (fieldNames.length === 0) return;
  
  console.log(`Drawing ${fieldNames.length} custom fields on image with default layout`);
  
  // تحديد عوامل القياس لحجم الخط لتعويض الفرق بين معاينة الواجهة والسيرفر
  // العرض الافتراضي لمعاينة الكانفاس في محرر Konva
  const clientCanvasWidth = 800; 
  // العرض الفعلي للكانفاس على السيرفر
  const serverCanvasWidth = width;
  // حساب معامل قياس الخط
  const fontScaleFactor = serverCanvasWidth / clientCanvasWidth;
  console.log(`Font scale factor: ${fontScaleFactor} (Server canvas: ${serverCanvasWidth}px, Client preview: ${clientCanvasWidth}px)`);

  // معلمات لتحديد موضع النص
  let spaceBetweenFields = height * 0.1;
  if (fieldNames.length > 5) {
    spaceBetweenFields = height * 0.7 / fieldNames.length;
  }
  
  let startY = height * 0.15;
  
  // تتبع الموضع المستخدم لكل حقل لتجنب التداخل
  const usedPositions: { x: number, y: number, height: number, width: number }[] = [];
  
  // ترتيب الحقول حسب طبقة العرض (رقم أصغر = طبقة أسفل)
  // نفترض أن الحقول التي تبدأ بـ "image" هي في طبقة أقل (أسفل)
  const sortedFieldNames = [...fieldNames].sort((a, b) => {
    const isAImage = a.toLowerCase().includes('image');
    const isBImage = b.toLowerCase().includes('image');
    if (isAImage && !isBImage) return -1;
    if (!isAImage && isBImage) return 1;
    return 0;
  });
  
  console.log(`Default layout: sorted fields by type: `, sortedFieldNames);
  
  // رسم كل حقل مرتبة حسب النوع (الصور أولاً)
  for (let i = 0; i < sortedFieldNames.length; i++) {
    const fieldName = sortedFieldNames[i];
    const index = i;
    const value = formData[fieldName];
    if (!value) continue;
    
    // معالجة حقول الصور أو الحقول التي تشير القيمة إلى مسار صورة
    const isImageField = fieldName.toLowerCase().includes('image');
    const isImagePath = typeof value === 'string' && (
      value.startsWith('/uploads/') || 
      value.startsWith(process.cwd()) || 
      value.startsWith('data:image/')
    );
    
    if (isImageField || isImagePath) {
      try {
        console.log(`Processing default image field: ${fieldName} with path: ${value}`);
        
        let imagePath = '';
        
        if (typeof value === 'string') {
          // تحديد المسار المطلق للصورة
          if (value.startsWith('/uploads/')) {
            imagePath = path.join(process.cwd(), value.substring(1));
            console.log(`Converted image path: ${value} to absolute path: ${imagePath}`);
          } else if (value.startsWith(process.cwd())) {
            imagePath = value;
          } else if (value.startsWith('data:image/')) {
            // معالجة الصور المضمنة (Data URLs)
            // حفظ الصورة المضمنة مؤقتًا إلى ملف
            const tempFilename = crypto.randomBytes(16).toString('hex') + '.png';
            const tempFilePath = path.join(process.cwd(), 'temp', tempFilename);
            
            // استخراج البيانات من Data URL
            const base64Data = value.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // حفظ الصورة إلى ملف مؤقت
            try {
              fs.writeFileSync(tempFilePath, buffer);
              imagePath = tempFilePath;
              console.log(`Saved embedded image to temporary file: ${tempFilePath}`);
            } catch (writeErr) {
              console.error(`Error saving embedded image to file: ${writeErr}`);
            }
          }
        }
        
        // التأكد من وجود مسار صورة صالح
        if (imagePath && fs.existsSync(imagePath)) {
          try {
            // حساب موضع الصورة
            const posX = width / 2; // افتراضي في المنتصف
            const posY = startY + index * spaceBetweenFields;
            
            const img = await loadImage(imagePath);
            
            // الحصول على أبعاد الصورة للحفاظ على نسبة العرض للارتفاع
            const imgWidth = img.width;
            const imgHeight = img.height;
            
            // تحديد حجم الصورة المعروضة
            let displayWidth = Math.min(imgWidth, width * 0.6);
            let displayHeight = (displayWidth / imgWidth) * imgHeight;
            
            // التحقق من تجاوز الحد الأقصى للارتفاع
            if (displayHeight > height * 0.4) {
              displayHeight = height * 0.4;
              displayWidth = (displayHeight / imgHeight) * imgWidth;
            }
            
            // ضبط موضع الصورة
            const imgX = posX - (displayWidth / 2);
            
            // تطبيق شفافية (اختياري)
            ctx.globalAlpha = 1.0;
            
            // رسم إطار للصورة (اختياري)
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 0; // لا إطار افتراضيًا
            
            // رسم الصورة على القالب
            ctx.drawImage(img, imgX, posY - (displayHeight / 2), displayWidth, displayHeight);
            
            // إعادة ضبط الشفافية
            ctx.globalAlpha = 1.0;
            
            console.log(`Default image drawn for field ${fieldName} at position (${imgX}, ${posY}) with dimensions ${displayWidth}x${displayHeight}`);
          } catch (err) {
            console.error(`Failed to load default image for field ${fieldName}: ${err}`);
          }
        } else {
          console.error(`Default image file not found: ${imagePath || 'no path provided'}`);
        }
      } catch (err) {
        console.error(`Error processing default image field ${fieldName}: ${err}`);
      }
      
      continue;
    }
    
    // معالجة حقول النص
    const text = String(value);
    
    // تعيين الخط المناسب حسب عدد الحقول مع تطبيق معامل القياس
    const originalFontSize = fieldNames.length > 5 ? 26 : 30;
    // تطبيق معامل قياس الخط للتعويض عن الفرق بين حجم الكانفاس في الواجهة والسيرفر
    const fontSize = Math.round(originalFontSize * fontScaleFactor);
    console.log(`Field ${fieldName} font size: original=${originalFontSize}px, scaled=${fontSize}px (scale=${fontScaleFactor})`);
    ctx.font = `${fontSize}px ${ARABIC_FONTS.CAIRO}`;
    
    // حساب الموضع مع تجنب التداخل
    const posX = width / 2;
    const posY = startY + (index * spaceBetweenFields);
    
    // حساب عرض النص لاستخدامه في تتبع المواضع المستخدمة
    const textWidth = ctx.measureText(text).width;
    
    // رسم النص مع تطبيق التفاف الكلمات المحسن
    const lines = wrapText(ctx, text, width - 100, fontSize, 1.4);
    
    // زيادة التباعد بين السطور بشكل كبير لضمان عدم تداخل النصوص
    const lineHeight = fontSize * 1.4;
    let totalHeight = lineHeight * lines.length;
    
    // توسيط النص عمودياً
    let currentY = posY - (totalHeight / 2) + (lineHeight / 2);
    
    for (const line of lines) {
      // إصلاح مشكلة لون النص الأسود الذي يظهر باللون الأبيض
      if (fixTextColor && ctx.fillStyle && ctx.fillStyle.toString().toLowerCase() === '#000000') {
        // حفظ سياق الرسم الحالي
        ctx.save();
        
        // إزالة الظل للنص الأسود
        ctx.shadowBlur = 0;
        
        // استخدام طريقة الرسم الصحيحة للون الأسود
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillText(line, posX, currentY);
        
        // استعادة سياق الرسم الأصلي
        ctx.restore();
      } else {
        // رسم النص بالطريقة العادية
        ctx.fillText(line, posX, currentY);
      }
      
      currentY += lineHeight;
    }
  }
}

// حالات خاصة حسب نوع البطاقة
function drawWeddingText(ctx: any, formData: any, width: number, height: number) {
  // أسماء العروسين
  ctx.font = `bold 50px ${ARABIC_FONTS.CAIRO_BOLD}`;
  ctx.textAlign = "center";
  
  const nameY = height * 0.4;
  
  if (formData.bride && formData.groom) {
    ctx.fillText(`${formData.groom} & ${formData.bride}`, width / 2, nameY);
  } else if (formData.names) {
    ctx.fillText(formData.names, width / 2, nameY);
  }
  
  // تاريخ الزفاف
  if (formData.date) {
    ctx.font = `45px ${ARABIC_FONTS.CAIRO}`;
    ctx.fillText(formatDate(formData.date), width / 2, nameY + 80);
  }
  
  // مكان الحفل
  if (formData.venue) {
    ctx.font = `35px ${ARABIC_FONTS.CAIRO}`;
    ctx.fillText(formData.venue, width / 2, nameY + 140);
  }
  
  // وقت الحفل
  if (formData.time) {
    ctx.font = `35px ${ARABIC_FONTS.CAIRO}`;
    ctx.fillText(formatTime(formData.time), width / 2, nameY + 190);
  }
}

function drawEngagementText(ctx: any, formData: any, width: number, height: number) {
  // محتوى مشابه لبطاقة الزفاف
  drawWeddingText(ctx, formData, width, height);
}

function drawGraduationText(ctx: any, formData: any, width: number, height: number) {
  // اسم الطالب
  ctx.font = `bold 50px ${ARABIC_FONTS.CAIRO_BOLD}`;
  ctx.textAlign = "center";
  
  const nameY = height * 0.4;
  
  if (formData.student) {
    ctx.fillText(formData.student, width / 2, nameY);
  }
  
  // الشهادة أو التخصص
  if (formData.degree) {
    ctx.font = `45px ${ARABIC_FONTS.CAIRO}`;
    ctx.fillText(formData.degree, width / 2, nameY + 80);
  }
  
  // الجامعة أو المدرسة
  if (formData.institution) {
    ctx.font = `35px ${ARABIC_FONTS.CAIRO}`;
    ctx.fillText(formData.institution, width / 2, nameY + 140);
  }
  
  // سنة التخرج
  if (formData.year) {
    ctx.font = `45px ${ARABIC_FONTS.CAIRO_BOLD}`;
    ctx.fillText(formData.year, width / 2, nameY + 190);
  }
}

function drawEidText(ctx: any, formData: any, width: number, height: number) {
  // تهنئة العيد
  ctx.font = `bold 50px ${ARABIC_FONTS.AMIRI_BOLD}`;
  ctx.textAlign = "center";
  
  const greetingY = height * 0.4;
  
  if (formData.greeting) {
    ctx.fillText(formData.greeting, width / 2, greetingY);
  } else {
    ctx.fillText("عيد مبارك", width / 2, greetingY);
  }
  
  // من (المرسل)
  if (formData.from) {
    ctx.font = `40px ${ARABIC_FONTS.CAIRO}`;
    ctx.fillText(`من: ${formData.from}`, width / 2, greetingY + 80);
  }
  
  // إلى (المستقبل)
  if (formData.to) {
    ctx.font = `40px ${ARABIC_FONTS.CAIRO}`;
    ctx.fillText(`إلى: ${formData.to}`, width / 2, greetingY + 140);
  }
  
  // رسالة إضافية
  if (formData.message) {
    ctx.font = `30px ${ARABIC_FONTS.AMIRI}`;
    const lines = wrapText(ctx, formData.message, width - 150);
    let messageY = greetingY + 210;
    
    for (const line of lines) {
      ctx.fillText(line, width / 2, messageY);
      messageY += 40;
    }
  }
}

function drawRamadanText(ctx: any, formData: any, width: number, height: number) {
  // محتوى مشابه لبطاقة العيد
  drawEidText(ctx, formData, width, height);
}

// Utility function to wrap text
/**
 * وظيفة محسنة لتقسيم النص إلى أسطر متعددة حسب العرض المحدد
 * تم تحسين الأداء باستخدام كاش لقياسات النص وتقليل عدد عمليات القياس
 * 
 * @param ctx سياق الرسم Canvas context
 * @param text النص المراد تقسيمه
 * @param maxWidth العرض الأقصى المسموح به
 * @returns مصفوفة من الأسطر
 */
/**
 * دالة محسّنة للف النص بأسطر متعددة - محدثة للتطابق 100% مع معاينة حقول القالب
 * 
 * @param ctx سياق الكانفاس
 * @param text النص المراد لفه
 * @param maxWidth أقصى عرض مسموح للسطر
 * @param fontSize حجم الخط (افتراضيا 24)
 * @param lineHeightFactor معامل ارتفاع السطر (افتراضيا 1.3)
 * @returns مصفوفة من أسطر النص المقسمة
 */
function wrapText(ctx: any, text: string, maxWidth: number, fontSize: number = 24, lineHeightFactor: number = 1.3): string[] {
  // التعامل مع الحالات الخاصة
  if (!text) return [];
  if (maxWidth <= 0) return [text];
  
  // تقريب الأرقام لضمان الاتساق مع المعاينة
  fontSize = Math.round(fontSize);
  maxWidth = Math.round(maxWidth);
  
  // تقليل العرض المتاح قليلاً لضمان عدم التداخل وتطابق مع المعاينة
  // هذا مهم خاصةً في المعاينة حيث تكون الأحجام أصغر
  const safeMaxWidth = Math.round(maxWidth * 0.95);
  
  // تحسين: استخدام الكاش لتخزين قياسات النص
  const measureCache: Record<string, number> = {};
  
  // وظيفة مساعدة لقياس النص مع استخدام الكاش
  const measureText = (str: string): number => {
    if (!measureCache[str]) {
      const width = ctx.measureText(str).width;
      // تقريب القياس لمطابقة المعاينة
      measureCache[str] = Math.round(width);
    }
    return measureCache[str];
  };
  
  // معالجة النصوص الطويلة جداً بدون مسافات
  if (text.length > 10 && !text.includes(' ')) {
    const chars = text.split('');
    const lines: string[] = [];
    let currentLine = chars[0];
    
    for (let i = 1; i < chars.length; i++) {
      const char = chars[i];
      if (measureText(currentLine + char) <= safeMaxWidth) {
        currentLine += char;
      } else {
        lines.push(currentLine);
        currentLine = char;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }
  
  // التعامل مع النصوص العادية التي تحتوي على مسافات
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
    // حالة السطر الفارغ (بداية النص)
    if (currentLine === '') {
      // التحقق إذا كانت الكلمة أطول من العرض المتاح
      if (measureText(word) > safeMaxWidth) {
        // تقسيم الكلمة الطويلة حرفاً بحرف
        let partialWord = '';
        for (let j = 0; j < word.length; j++) {
          const char = word[j];
          if (measureText(partialWord + char) <= safeMaxWidth) {
            partialWord += char;
          } else {
            lines.push(partialWord);
            partialWord = char;
          }
        }
        
        if (partialWord) {
          currentLine = partialWord;
        }
      } else {
        // استخدام الكلمة كاملة إذا كانت تناسب العرض
        currentLine = word;
      }
    } else {
      // إضافة كلمة إلى سطر موجود
      const testLine = currentLine + ' ' + word;
      if (measureText(testLine) <= safeMaxWidth) {
        currentLine = testLine;
      } else {
        // إضافة السطر الحالي وبدء سطر جديد
        lines.push(currentLine);
        
        // التحقق مما إذا كانت الكلمة التالية أطول من العرض المتاح
        if (measureText(word) > safeMaxWidth) {
          // تقسيم الكلمة الطويلة
          let partialWord = '';
          for (let j = 0; j < word.length; j++) {
            const char = word[j];
            if (measureText(partialWord + char) <= safeMaxWidth) {
              partialWord += char;
            } else {
              lines.push(partialWord);
              partialWord = char;
            }
          }
          
          currentLine = partialWord || '';
        } else {
          currentLine = word;
        }
      }
    }
  }
  
  // إضافة السطر الأخير
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

// Certificate generation
export async function generateCertificateImage(template: Template, formData: any): Promise<string> {
  // For now, redirect to card image generation with the same function
  return generateCardImage(template, formData, 'download');
}