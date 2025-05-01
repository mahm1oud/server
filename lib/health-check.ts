/**
 * نظام فحص الصحة والمراقبة للخدمات
 * 
 * هذا الملف يوفر دوال ومكونات لمراقبة صحة التطبيق
 * ويمكن استخدامه للتحقق من حالة الخدمات المختلفة
 * مثل قاعدة البيانات، مساحة التخزين، إلخ.
 */

import { Request, Response, Router } from 'express';
import { db, pool } from '../db';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { sql } from 'drizzle-orm';

// تعريف نوع معلومات الصحة
interface HealthInfo {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  services: {
    database: {
      status: 'healthy' | 'unhealthy' | 'degraded';
      responseTime?: number;
      message?: string;
    };
    storage: {
      status: 'healthy' | 'unhealthy' | 'degraded';
      message?: string;
      availableSpace?: string;
    };
    system: {
      memory: {
        total: string;
        free: string;
        used: string;
        percentUsed: number;
      };
      cpu: {
        loadAverage: number[];
        cores: number;
      };
    };
  };
}

// الحصول على معلومات الإصدار من package.json
function getVersionInfo(): string {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version || 'unknown';
  } catch (error) {
    console.error('Error reading version info:', error);
    return 'unknown';
  }
}

// فحص صحة قاعدة البيانات
async function checkDatabaseHealth() {
  const startTime = Date.now();
  try {
    // إجراء استعلام بسيط للتحقق من اتصال قاعدة البيانات
    await db.execute(sql`SELECT 1`);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return {
      status: 'healthy' as const,
      responseTime,
      message: 'Database connection successful'
    };
  } catch (error: any) {
    console.error('Database health check failed:', error);
    return {
      status: 'unhealthy' as const,
      message: `Database connection failed: ${error.message}`
    };
  }
}

// فحص صحة نظام التخزين
function checkStorageHealth() {
  try {
    const uploadsDir = path.resolve(__dirname, '../../uploads');
    const tempDir = path.resolve(__dirname, '../../temp');
    
    // التحقق من وجود المجلدات الضرورية
    if (!fs.existsSync(uploadsDir) || !fs.existsSync(tempDir)) {
      return {
        status: 'degraded' as const,
        message: 'Some required directories are missing'
      };
    }
    
    // التحقق من إمكانية الكتابة
    try {
      const testFile = path.join(tempDir, `test-write-${Date.now()}.tmp`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (error) {
      return {
        status: 'unhealthy' as const,
        message: 'Storage is not writable'
      };
    }
    
    // الحصول على معلومات مساحة التخزين (على نظم لينكس)
    let availableSpace = 'unknown';
    try {
      if (process.platform === 'linux') {
        const df = require('child_process').execSync('df -h / | tail -1').toString();
        availableSpace = df.split(/\s+/)[3];
      }
    } catch (e) {
      // يتم تجاهل الأخطاء هنا، ونستمر بدون معلومات المساحة
    }
    
    return {
      status: 'healthy' as const,
      message: 'Storage is accessible and writable',
      availableSpace
    };
  } catch (error: any) {
    return {
      status: 'unhealthy' as const,
      message: `Storage check failed: ${error.message}`
    };
  }
}

// الحصول على معلومات موارد النظام
function getSystemInfo() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const percentUsed = Math.round((usedMemory / totalMemory) * 100);
  
  return {
    memory: {
      total: `${Math.round(totalMemory / 1024 / 1024)} MB`,
      free: `${Math.round(freeMemory / 1024 / 1024)} MB`,
      used: `${Math.round(usedMemory / 1024 / 1024)} MB`,
      percentUsed
    },
    cpu: {
      loadAverage: os.loadavg(),
      cores: os.cpus().length
    }
  };
}

// دالة تجميع كل المعلومات
export async function getFullHealthCheck(): Promise<HealthInfo> {
  const dbHealth = await checkDatabaseHealth();
  const storageHealth = checkStorageHealth();
  const systemInfo = getSystemInfo();
  
  // تحديد الحالة العامة بناءً على حالة المكونات الفرعية
  let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
  if (dbHealth.status === 'unhealthy' || storageHealth.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  } else if (dbHealth.status === 'degraded' || storageHealth.status === 'degraded') {
    overallStatus = 'degraded';
  }
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: getVersionInfo(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    services: {
      database: dbHealth,
      storage: storageHealth,
      system: systemInfo
    }
  };
}

// دالة تصدير لاستخدامها مع Express
export async function healthCheckHandler(req: Request, res: Response) {
  try {
    const healthInfo = await getFullHealthCheck();
    
    // تعيين كود الاستجابة بناءً على الحالة
    let statusCode = 200;
    if (healthInfo.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    } else if (healthInfo.status === 'degraded') {
      statusCode = 200; // حالة متدهورة لكن لا تزال تعمل
    }
    
    res.status(statusCode).json(healthInfo);
  } catch (error: any) {
    console.error('Error in health check handler:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
}

// دالة لمسار فحص صحة مبسط للمراقبة الخارجية (K8s, AWS ALB, etc)
export async function simpleHealthCheckHandler(req: Request, res: Response) {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.status === 'healthy') {
      return res.status(200).send('OK');
    } else {
      return res.status(503).send('Service Unavailable');
    }
  } catch (error) {
    return res.status(500).send('Internal Server Error');
  }
}

/**
 * إنشاء موجه لمسارات فحص الصحة
 * 
 * يقوم بإنشاء موجه Express مع مسارات مخصصة لفحص صحة التطبيق
 * 
 * @returns موجه Express مع مسارات فحص الصحة
 */
export function createHealthCheckRouter() {
  const router = Router();
  
  // مسار الفحص الكامل
  router.get('/health', healthCheckHandler);
  
  // مسار الفحص البسيط
  router.get('/health/simple', simpleHealthCheckHandler);
  
  // مسار للفحص السريع للاستخدام في فحص جاهزية k8s
  router.get('/ready', (req, res) => res.status(200).send('OK'));
  
  // مسار للفحص السريع للاستخدام في فحص حياة k8s
  router.get('/live', (req, res) => res.status(200).send('OK'));
  
  return router;
}