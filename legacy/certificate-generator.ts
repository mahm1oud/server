import { Template } from '@shared/schema';
import { createCanvas, loadImage, registerFont } from 'canvas';
import * as fs from 'fs';
import * as path from 'path';

// Try to register custom fonts if available
try {
  registerFont(path.join(process.cwd(), 'assets/fonts/Tajawal-Regular.ttf'), { family: 'Tajawal' });
  registerFont(path.join(process.cwd(), 'assets/fonts/Tajawal-Bold.ttf'), { family: 'Tajawal', weight: 'bold' });
  registerFont(path.join(process.cwd(), 'assets/fonts/Amiri-Regular.ttf'), { family: 'Amiri' });
  registerFont(path.join(process.cwd(), 'assets/fonts/DecoTypeNaskh.ttf'), { family: 'DecoType Naskh' });
  console.log("Custom fonts registered successfully");
} catch (error) {
  console.warn("Could not register custom fonts, using system fonts instead");
}

/**
 * Generate a certificate image with the provided template and form data
 * 
 * @param template The template to use for the certificate
 * @param formData The user input data to overlay on the template
 * @returns Path to the generated image
 */
export async function generateCertificateImage(template: Template, formData: any): Promise<string> {
  try {
    console.log("Starting certificate image generation for template:", template.id, template.title);
    
    // استخراج إعدادات القالب أو استخدام قيم افتراضية
    const settings = template.settings as Record<string, any> || {};
    
    // استخراج الاتجاه من إعدادات القالب (أفقي أو عمودي)
    const orientation = (settings.orientation as string) || 'portrait';
    
    // استخراج حجم الصورة المخصص أو الحفاظ على النسبة الأصلية
    const useCustomSize = settings.useCustomSize === true;
    const customWidth = useCustomSize ? parseInt(settings.customWidth as string) || 0 : 0;
    const customHeight = useCustomSize ? parseInt(settings.customHeight as string) || 0 : 0;
    
    // Load the template image
    const imageUrl = template.imageUrl.startsWith('http') 
      ? template.imageUrl 
      : path.join(process.cwd(), template.imageUrl.replace(/^\//, ''));
    
    console.log(`Loading template image from: ${imageUrl}`);
    const templateImage = await loadImage(imageUrl);
    
    // Set canvas dimensions based on template settings
    let width, height;
    
    // استخدام الأبعاد المخصصة إذا تم تحديدها وكانت صالحة
    if (useCustomSize && customWidth > 0 && customHeight > 0) {
      console.log(`Using custom dimensions from template settings: ${customWidth}x${customHeight}`);
      width = customWidth;
      height = customHeight;
    } else if (orientation === 'landscape') {
      // للشهادات الأفقية، استخدم أبعاد مناسبة أو اعكس الأبعاد الأصلية
      if (templateImage.width > templateImage.height) {
        // الصورة بالفعل أفقية
        width = templateImage.width;
        height = templateImage.height;
      } else {
        // الصورة عمودية، نحتاج لعكس النسبة
        width = templateImage.height;
        height = templateImage.width;
      }
    } else {
      // للشهادات العمودية (الافتراضي)، استخدم الأبعاد الأصلية
      width = templateImage.width;
      height = templateImage.height;
    }
    
    console.log(`Canvas dimensions set to: ${width}x${height}, orientation: ${orientation}`);
    
    // Create canvas and get context
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // تطبيق إعدادات الصورة حسب التوجيه
    if (orientation === 'landscape' && templateImage.width < templateImage.height) {
      // إذا كانت الصورة عمودية ونريدها أفقية، نرسمها بعد تدويرها 90 درجة
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(Math.PI / 2); // 90 درجة
      const drawWidth = height;
      const drawHeight = width;
      ctx.drawImage(templateImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
    } else if (orientation === 'portrait' && templateImage.width > templateImage.height) {
      // إذا كانت الصورة أفقية ونريدها عمودية، نرسمها بعد تدويرها -90 درجة
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(-Math.PI / 2); // -90 درجة
      const drawWidth = height;
      const drawHeight = width;
      ctx.drawImage(templateImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
    } else {
      // لا حاجة للتدوير، ارسم الصورة كما هي
      ctx.drawImage(templateImage, 0, 0, width, height);
    }
    
    // Set default styles
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = settings.textColor || '#000000';
    
    // Font family preference
    const fontFamily = settings.certificateFontFamily || settings.fontFamily || 'DecoType Naskh, Amiri, Arial';
    const fontSize = settings.fontSize || 24;
    
    // Fetch template fields from database if not provided in template object
    let templateFields = [];
    
    try {
      if (Array.isArray(template.templateFields) && template.templateFields.length > 0) {
        templateFields = template.templateFields;
      } else {
        // Fetch fields from database
        const { db } = await import('./db');
        const { templateFields: templateFieldsTable } = await import('@shared/schema');
        
        // Query fields for this template
        templateFields = await db.query.templateFields.findMany({
          where: (fields, { eq }) => eq(fields.templateId, template.id)
        });
        
        console.log(`Fetched ${templateFields.length} template fields from database for template ID ${template.id}`);
      }
    } catch (error) {
      console.warn(`Error fetching template fields: ${error}. Using default rendering.`);
    }
    
    // If we have template fields with positions, use them for rendering
    if (templateFields.length > 0) {
      console.log(`Rendering certificate with ${templateFields.length} custom fields`);
      
      // Render text based on defined field positions
      for (const field of templateFields) {
        if (!formData[field.name] && !field.defaultValue) continue;
        
        const value = formData[field.name] || field.defaultValue || '';
        const fieldStyle = field.style || {};
        const position = field.position || {};
        
        // Calculate position based on percentage or default to center
        const x = position.x !== undefined ? (position.x / 100) * width : width / 2;
        const y = position.y !== undefined ? (position.y / 100) * height : height / 2;
        
        console.log(`Rendering field ${field.name} at position (${position.x}%, ${position.y}%) => (${Math.round(x)}px, ${Math.round(y)}px)`);
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Set field-specific styles
        ctx.fillStyle = fieldStyle.color || settings.textColor || '#000000';
        
        // تحديد وزن الخط وحجمه ونوعه
        const fontWeight = fieldStyle.fontWeight || fieldStyle.weight || '';
        const fieldFontSize = fieldStyle.fontSize || fieldStyle.size || fontSize;
        const fieldFontFamily = fieldStyle.fontFamily || fontFamily;
        ctx.font = `${fontWeight} ${fieldFontSize}px ${fieldFontFamily}`;
        
        // تحديد محاذاة النص
        ctx.textAlign = fieldStyle.align || 'center';
        
        // إضافة ظل النص عند الحاجة
        if (fieldStyle.textShadow) {
          ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
          ctx.shadowBlur = 5;
        }
        
        // Draw text
        if (typeof value === 'string') {
          const lines = wrapText(ctx, value, width * 0.8);
          const lineHeight = parseInt(fieldStyle.size || fontSize, 10) * 1.2;
          
          lines.forEach((line, index) => {
            ctx.fillText(line, x, y + (index * lineHeight));
          });
        }
      }
    } else {
      // Default rendering based on certificate type
      const certificateType = formData.certificateType || template.certificateType || 'appreciation';
      
      ctx.font = `bold ${fontSize * 1.5}px ${fontFamily}`;
      
      // Draw certificate title
      const title = formData.title || template.title || 'شهادة تقدير';
      ctx.fillText(title, width / 2, height * 0.15);
      
      // Draw main content based on certificate type
      ctx.font = `${fontSize}px ${fontFamily}`;
      
      // Adjust gender-specific text if needed
      const gender = formData.issuedToGender || 'male';
      const prefix = gender === 'female' ? 'تشهد' : 'يشهد';
      const recipient = gender === 'female' ? 'للطالبة' : 'للطالب';
      
      // Draw school/organization name
      if (formData.schoolName) {
        ctx.fillText(`${prefix} إدارة ${formData.schoolName}`, width / 2, height * 0.25);
      }
      
      // Draw recipient name
      if (formData.issuedTo) {
        ctx.fillText(`${recipient}: ${formData.issuedTo}`, width / 2, height * 0.35);
      }
      
      // Draw reason
      if (formData.reason) {
        const reasonLines = wrapText(ctx, formData.reason, width * 0.7);
        reasonLines.forEach((line, index) => {
          ctx.fillText(line, width / 2, height * 0.45 + (index * fontSize * 1.3));
        });
      }
      
      // Draw date
      if (formData.date) {
        ctx.fillText(`التاريخ: ${formData.date}`, width / 2, height * 0.78);
      }
      
      // Draw signatures
      ctx.font = `bold ${fontSize * 0.9}px ${fontFamily}`;
      
      // First signature (Principal)
      if (formData.principalTitle) {
        ctx.fillText(formData.principalTitle, width * 0.2, height * 0.85);
        if (formData.principalName) {
          ctx.font = `${fontSize * 0.8}px ${fontFamily}`;
          ctx.fillText(formData.principalName, width * 0.2, height * 0.9);
          ctx.font = `bold ${fontSize * 0.9}px ${fontFamily}`;
        }
      }
      
      // Second signature
      if (formData.secondaryTitle) {
        ctx.fillText(formData.secondaryTitle, width * 0.5, height * 0.85);
        if (formData.secondaryName) {
          ctx.font = `${fontSize * 0.8}px ${fontFamily}`;
          ctx.fillText(formData.secondaryName, width * 0.5, height * 0.9);
          ctx.font = `bold ${fontSize * 0.9}px ${fontFamily}`;
        }
      }
      
      // Third signature
      if (formData.thirdTitle) {
        ctx.fillText(formData.thirdTitle, width * 0.8, height * 0.85);
        if (formData.thirdName) {
          ctx.font = `${fontSize * 0.8}px ${fontFamily}`;
          ctx.fillText(formData.thirdName, width * 0.8, height * 0.9);
        }
      }
      
      // Add logos if provided
      if (formData.logo1 && typeof formData.logo1 === 'string' && formData.logo1.startsWith('data:image')) {
        try {
          const logo1 = await loadImage(formData.logo1);
          const logoSize = height * 0.12;
          ctx.drawImage(logo1, width * 0.15 - logoSize / 2, height * 0.1 - logoSize / 2, logoSize, logoSize);
        } catch (error) {
          console.error("Error loading logo1:", error);
        }
      }
      
      if (formData.logo2 && typeof formData.logo2 === 'string' && formData.logo2.startsWith('data:image')) {
        try {
          const logo2 = await loadImage(formData.logo2);
          const logoSize = height * 0.12;
          ctx.drawImage(logo2, width * 0.5 - logoSize / 2, height * 0.1 - logoSize / 2, logoSize, logoSize);
        } catch (error) {
          console.error("Error loading logo2:", error);
        }
      }
      
      if (formData.logo3 && typeof formData.logo3 === 'string' && formData.logo3.startsWith('data:image')) {
        try {
          const logo3 = await loadImage(formData.logo3);
          const logoSize = height * 0.12;
          ctx.drawImage(logo3, width * 0.85 - logoSize / 2, height * 0.1 - logoSize / 2, logoSize, logoSize);
        } catch (error) {
          console.error("Error loading logo3:", error);
        }
      }
    }
    
    // Save the image
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const fileName = `certificate_${Date.now()}.png`;
    const outputPath = path.join(uploadsDir, fileName);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    return outputPath;
  } catch (error) {
    console.error("Error generating certificate:", error);
    throw new Error("Failed to generate certificate");
  }
}

/**
 * Wrap text to fit within a given width
 * @param ctx Canvas context
 * @param text Text to wrap
 * @param maxWidth Maximum width
 * @returns Array of lines
 */
function wrapText(ctx: any, text: string, maxWidth: number): string[] {
  if (!text) return [];
  
  // Handle newlines in the text
  const paragraphs = text.split("\n");
  const result: string[] = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      result.push('');
      continue;
    }
    
    const words = paragraph.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line ? line + ' ' + word : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && line) {
        result.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }
    
    result.push(line);
  }
  
  return result;
}