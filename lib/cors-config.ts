/**
 * تكوين CORS للسماح بالطلبات من أصول مختلفة
 * 
 * هذا الملف يوفر تكوينًا مرنًا لـ CORS يعتمد على بيئة التشغيل
 * ويدعم قائمة من الأصول المسموح بها من خلال متغير البيئة ALLOWED_ORIGINS
 */

import cors from 'cors';
import { logger } from './logger';

/**
 * إنشاء تكوين CORS بناءً على متغيرات البيئة
 * 
 * @returns تكوين CORS الذي يمكن استخدامه مع middleware في Express
 */
export function createCorsConfig() {
  // استخراج الأصول المسموح بها من متغير البيئة
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
  
  // تحويل متغير البيئة إلى مصفوفة من الأصول المسموح بها
  const allowedOrigins = allowedOriginsEnv
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);
  
  // إضافة أصول إضافية في بيئة التطوير
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:5173'
    );
  }
  
  // تسجيل الأصول المسموح بها
  logger.info(`CORS is configured with the following allowed origins: ${allowedOrigins.join(', ')}`);
  
  // إنشاء تكوين CORS
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // السماح بطلبات بدون أصل (مثل طلبات API المباشرة)
      if (!origin) {
        callback(null, true);
        return;
      }
      
      // التحقق مما إذا كان الأصل موجودًا في القائمة المسموح بها
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        logger.warn(`Request from blocked origin: ${origin}`);
        callback(new Error(`Origin ${origin} not allowed by CORS policy`));
      }
    },
    credentials: true, // السماح بإرسال البيانات المصادقة (الكوكيز)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // تخزين مؤقت لنتائج preflight لمدة 24 ساعة
  };
  
  return corsOptions;
}

export default createCorsConfig;