/**
 * نظام تسجيل الأحداث (Logger)
 * 
 * يوفر هذا الملف واجهة موحدة لتسجيل الأحداث والأخطاء في التطبيق
 * مع دعم لمستويات مختلفة من التسجيل وتنسيقات مختلفة
 */

// تحديد مستويات التسجيل
enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// تكوين التسجيل
const config = {
  // المستوى المستخدم حالياً، يعتمد على بيئة التشغيل
  level: process.env.NODE_ENV === 'production' 
    ? LogLevel.INFO 
    : (process.env.LOG_LEVEL 
        ? parseInt(process.env.LOG_LEVEL) 
        : LogLevel.DEBUG),
  
  // تنسيق وقت التسجيل
  timestampFormat: 'h:mm:ss A',
  
  // تسجيل في ملف (للبيئة الإنتاجية)
  logToFile: process.env.NODE_ENV === 'production',
  
  // مسار ملف التسجيل
  logFilePath: './logs/app.log',
}

/**
 * تنسيق الوقت بالتنسيق المحدد
 * @param date تاريخ التسجيل
 * @returns سلسلة نصية بتنسيق الوقت المحدد
 */
function formatTimestamp(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
  
  return `${formattedHours}:${formattedMinutes}:${formattedSeconds} ${ampm}`;
}

/**
 * كائن التسجيل الرئيسي
 */
export const logger = {
  /**
   * تسجيل رسالة خطأ
   * @param message رسالة الخطأ
   * @param meta بيانات إضافية للتسجيل
   */
  error(message: string, meta?: any): void {
    if (config.level >= LogLevel.ERROR) {
      this._log('ERROR', message, meta);
    }
  },
  
  /**
   * تسجيل رسالة تحذير
   * @param message رسالة التحذير
   * @param meta بيانات إضافية للتسجيل
   */
  warn(message: string, meta?: any): void {
    if (config.level >= LogLevel.WARN) {
      this._log('WARN', message, meta);
    }
  },
  
  /**
   * تسجيل رسالة معلوماتية
   * @param message رسالة المعلومات
   * @param meta بيانات إضافية للتسجيل
   */
  info(message: string, meta?: any): void {
    if (config.level >= LogLevel.INFO) {
      this._log('INFO', message, meta);
    }
  },
  
  /**
   * تسجيل رسالة تصحيح
   * @param message رسالة التصحيح
   * @param meta بيانات إضافية للتسجيل
   */
  debug(message: string, meta?: any): void {
    if (config.level >= LogLevel.DEBUG) {
      this._log('DEBUG', message, meta);
    }
  },
  
  /**
   * دالة داخلية للتسجيل
   * @param level مستوى التسجيل
   * @param message الرسالة
   * @param meta بيانات إضافية
   */
  _log(level: string, message: string, meta?: any): void {
    const timestamp = formatTimestamp(new Date());
    
    // تنسيق الرسالة
    let formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    // إضافة البيانات الإضافية إن وجدت
    if (meta) {
      // معالجة حالة الأخطاء
      if (meta instanceof Error) {
        formattedMessage += `\n${meta.stack || meta.message}`;
      } else {
        try {
          // محاولة تحويل البيانات الإضافية إلى سلسلة نصية بتنسيق JSON
          formattedMessage += `\n${JSON.stringify(meta, null, 2)}`;
        } catch (error) {
          // إذا فشل التحويل، استخدم الطريقة الافتراضية
          formattedMessage += `\n${meta}`;
        }
      }
    }
    
    // طباعة الرسالة في وحدة التحكم
    if (level === 'ERROR') {
      console.error(formattedMessage);
    } else if (level === 'WARN') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
    
    // تسجيل في ملف في بيئة الإنتاج (يمكن إضافة ذلك لاحقاً)
    if (config.logToFile) {
      // لم يتم تنفيذ التسجيل في ملف هنا
      // يمكن إضافة مكتبة مثل winston لذلك
    }
  }
};

export default logger;