import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import session from "express-session";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { logger } from "./lib/logger";

// تكوين CORS البسيط للسماح بوصول الواجهة الأمامية من مصادر مختلفة
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');

(async () => {
  try {
    // إنشاء تطبيق Express
    const app = express();

    // تكوين CORS للسماح بالوصول من مصادر محددة
    app.use(cors({
      origin: function(origin, callback) {
        // السماح بالطلبات بدون أصل (مثل الطلبات من المتصفح مباشرة أو من بوستمان)
        if (!origin) return callback(null, true);
        
        // التحقق مما إذا كان الأصل مسموحًا به
        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
          callback(null, true);
        } else {
          logger.warn(`CORS: Origin ${origin} not allowed`);
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));
    
    // عرض النطاقات المسموح بها في السجل
    logger.info(`CORS: Allowed origins: ${allowedOrigins.join(', ')}`);

    // تكوين محلل JSON
    app.use(express.json());

    // إعداد الجلسات
    const sessionOptions: session.SessionOptions = {
      secret: process.env.SESSION_SECRET || "development-secret-key",
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
      },
    };

    app.use(session(sessionOptions));

    // تكوين Passport.js للمصادقة
    app.use(passport.initialize());
    app.use(passport.session());

    // إعداد المصادقة
    setupAuth(app);

    // إعداد المسارات الثابتة
    const staticPath = path.resolve(
      process.cwd(),
      process.env.NODE_ENV === "production" ? "../client/dist" : "../client/static"
    );
    console.log(`Serving static files from: ${staticPath}`);
    app.use(express.static(staticPath));

    // إعداد المسارات الثابتة للملفات المرفوعة
    const uploadsPath = path.resolve(process.cwd(), "../uploads");
    app.use("/uploads", express.static(uploadsPath));

    // تسجيل المسارات الخاصة بالتطبيق
    const server = await registerRoutes(app);

    // معالجة الأخطاء العامة
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error(err);
      res.status(err.status || 500).json({
        message: err.message || "حدث خطأ غير متوقع",
        error: process.env.NODE_ENV === "development" ? err : {},
      });
    });

    // الاستماع إلى المنفذ
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`[express] serving on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();