/**
 * @deprecated - هذا ملف قديم، يرجى استخدام optimized-image-generator.ts بدلاً منه
 * 
 * هذا الملف موجود فقط للحفاظ على التوافق مع الرموز القديمة
 */

import { generateOptimizedCardImage, generateOptimizedCertificateImage } from './optimized-image-generator';
import type { Template } from '@shared/schema';

// تصدير دوال مولد الصور المحسن بنفس أسماء الدوال القديمة للحفاظ على التوافق
export const generateCardImage = async (
  template: Template, 
  formData: any, 
  quality: 'preview' | 'download' | 'low' | 'medium' | 'high' = 'high'
): Promise<string> => {
  console.warn('استخدام الدالة القديمة generateCardImage. يرجى التحديث لاستخدام generateOptimizedCardImage');
  
  return generateOptimizedCardImage({
    templatePath: template.imageUrl,
    fields: template.fields || [],
    formData,
    quality,
    outputWidth: template.settings?.width || 1200,
    outputHeight: template.settings?.height || 1600
  });
};

export const generateCertificateImage = async (
  template: Template, 
  formData: any
): Promise<string> => {
  console.warn('استخدام الدالة القديمة generateCertificateImage. يرجى التحديث لاستخدام generateOptimizedCertificateImage');
  
  return generateOptimizedCertificateImage(template, formData);
};

// ملاحظة: النسخة الأصلية القديمة من هذا الملف موجودة في مجلد legacy