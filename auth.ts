import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as TwitterStrategy } from "passport-twitter";
import { Strategy as LinkedInStrategy } from "passport-linkedin-oauth2";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface User extends User {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || randomUUID(),
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // استراتيجية تسجيل الدخول المحلية
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "اسم المستخدم غير موجود" });
        }
        
        if (!user.active) {
          return done(null, false, { message: "الحساب غير نشط" });
        }
        
        if (!(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "كلمة المرور غير صحيحة" });
        }
        
        // Update last login time
        await storage.updateUser(user.id, { lastLogin: new Date() });
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );
  
  // إعداد استراتيجية جوجل
  const setupGoogleStrategy = async () => {
    try {
      const googleSettings = await storage.getAuthSettings('google');
      if (googleSettings?.enabled && googleSettings.clientId && googleSettings.clientSecret) {
        passport.use(
          new GoogleStrategy({
            clientID: googleSettings.clientId,
            clientSecret: googleSettings.clientSecret,
            callbackURL: googleSettings.redirectUri || '/auth/google/callback',
            scope: googleSettings.scope?.split(',') || ['profile', 'email']
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              // البحث عن المستخدم بمعرف المزود
              let user = await storage.getUserByProviderId('google', profile.id);
              
              // إذا لم يتم العثور على المستخدم، ابحث عن طريق البريد الإلكتروني
              if (!user && profile.emails && profile.emails.length > 0) {
                const email = profile.emails[0].value;
                user = await storage.getUserByEmail(email);
                
                // إذا وجدنا مستخدم بنفس البريد الإلكتروني، قم بتحديث بيانات المزود
                if (user) {
                  user = await storage.updateUser(user.id, {
                    provider: 'google',
                    providerId: profile.id,
                    providerData: profile
                  });
                }
              }
              
              // إذا لم يتم العثور على المستخدم، أنشئ حسابًا جديدًا
              if (!user) {
                const email = profile.emails && profile.emails.length > 0
                  ? profile.emails[0].value
                  : `${profile.id}@google.user`;
                
                const username = profile.displayName
                  ? profile.displayName.replace(/\s+/g, '_').toLowerCase()
                  : `user_${profile.id}`;
                
                const newUser = {
                  username,
                  email,
                  name: profile.displayName || username,
                  password: '', // لا نحتاج كلمة مرور للمصادقة الاجتماعية
                  provider: 'google',
                  providerId: profile.id,
                  providerData: profile,
                  profileImageUrl: profile.photos && profile.photos.length > 0
                    ? profile.photos[0].value
                    : null,
                  verifiedEmail: true, // عادة ما تكون البريد الإلكتروني مؤكد من جوجل
                  role: 'user',
                  active: true
                };
                
                user = await storage.createUser(newUser);
              }
              
              // تحديث وقت آخر تسجيل دخول
              await storage.updateUser(user.id, { lastLogin: new Date() });
              
              return done(null, user);
            } catch (error) {
              return done(error);
            }
          })
        );
        console.log('Google authentication strategy configured');
      } else {
        console.log('Google authentication is disabled or missing configuration');
      }
    } catch (error) {
      console.error('Error setting up Google strategy:', error);
    }
  };
  
  // إعداد استراتيجية فيسبوك
  const setupFacebookStrategy = async () => {
    try {
      const facebookSettings = await storage.getAuthSettings('facebook');
      if (facebookSettings?.enabled && facebookSettings.clientId && facebookSettings.clientSecret) {
        passport.use(
          new FacebookStrategy({
            clientID: facebookSettings.clientId,
            clientSecret: facebookSettings.clientSecret,
            callbackURL: facebookSettings.redirectUri || '/auth/facebook/callback',
            profileFields: ['id', 'displayName', 'email', 'photos']
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              // البحث عن المستخدم بمعرف المزود
              let user = await storage.getUserByProviderId('facebook', profile.id);
              
              // إذا لم يتم العثور على المستخدم، ابحث عن طريق البريد الإلكتروني
              if (!user && profile.emails && profile.emails.length > 0) {
                const email = profile.emails[0].value;
                user = await storage.getUserByEmail(email);
                
                // إذا وجدنا مستخدم بنفس البريد الإلكتروني، قم بتحديث بيانات المزود
                if (user) {
                  user = await storage.updateUser(user.id, {
                    provider: 'facebook',
                    providerId: profile.id,
                    providerData: profile
                  });
                }
              }
              
              // إذا لم يتم العثور على المستخدم، أنشئ حسابًا جديدًا
              if (!user) {
                const email = profile.emails && profile.emails.length > 0
                  ? profile.emails[0].value
                  : `${profile.id}@facebook.user`;
                
                const username = profile.displayName
                  ? profile.displayName.replace(/\s+/g, '_').toLowerCase()
                  : `user_${profile.id}`;
                
                const newUser = {
                  username,
                  email,
                  name: profile.displayName || username,
                  password: '', // لا نحتاج كلمة مرور للمصادقة الاجتماعية
                  provider: 'facebook',
                  providerId: profile.id,
                  providerData: profile,
                  profileImageUrl: profile.photos && profile.photos.length > 0
                    ? profile.photos[0].value
                    : null,
                  verifiedEmail: true, // نفترض أن البريد الإلكتروني مؤكد من فيسبوك
                  role: 'user',
                  active: true
                };
                
                user = await storage.createUser(newUser);
              }
              
              // تحديث وقت آخر تسجيل دخول
              await storage.updateUser(user.id, { lastLogin: new Date() });
              
              return done(null, user);
            } catch (error) {
              return done(error);
            }
          })
        );
        console.log('Facebook authentication strategy configured');
      } else {
        console.log('Facebook authentication is disabled or missing configuration');
      }
    } catch (error) {
      console.error('Error setting up Facebook strategy:', error);
    }
  };

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, false);
      }
      if (!user.active) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register route
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, email, password, name } = req.body;

      // Check if username exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "اسم المستخدم مستخدم بالفعل" });
      }

      // Check if email exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ message: "البريد الإلكتروني مستخدم بالفعل" });
      }

      // Create user with hashed password
      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        name,
        role: "user", // Default role for new registrations
        active: true
      });

      // Remove password from the response
      const { password: _, ...userWithoutPassword } = user;

      // Log in the user
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  // Login route
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: User, info: { message: string }) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ message: info.message || "فشل تسجيل الدخول" });
      }
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy((err) => {
        if (err) return next(err);
        res.clearCookie("connect.sid");
        res.sendStatus(200);
      });
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "غير مصرح به" });
    }
    
    const { password, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // إعداد استراتيجية تويتر
  const setupTwitterStrategy = async () => {
    try {
      const twitterSettings = await storage.getAuthSettings('twitter');
      if (twitterSettings?.enabled && twitterSettings.clientId && twitterSettings.clientSecret) {
        passport.use(
          new TwitterStrategy({
            consumerKey: twitterSettings.clientId,
            consumerSecret: twitterSettings.clientSecret,
            callbackURL: twitterSettings.redirectUri || '/auth/twitter/callback',
            includeEmail: true
          },
          async (token, tokenSecret, profile, done) => {
            try {
              // البحث عن المستخدم بمعرف المزود
              let user = await storage.getUserByProviderId('twitter', profile.id);
              
              // إذا لم يتم العثور على المستخدم، ابحث عن طريق البريد الإلكتروني
              if (!user && profile.emails && profile.emails.length > 0) {
                const email = profile.emails[0].value;
                user = await storage.getUserByEmail(email);
                
                // إذا وجدنا مستخدم بنفس البريد الإلكتروني، قم بتحديث بيانات المزود
                if (user) {
                  user = await storage.updateUser(user.id, {
                    provider: 'twitter',
                    providerId: profile.id,
                    providerData: profile
                  });
                }
              }
              
              // إذا لم يتم العثور على المستخدم، أنشئ حسابًا جديدًا
              if (!user) {
                const email = profile.emails && profile.emails.length > 0
                  ? profile.emails[0].value
                  : `${profile.id}@twitter.user`;
                
                const username = profile.username || profile.displayName 
                  ? (profile.username || profile.displayName).replace(/\s+/g, '_').toLowerCase()
                  : `user_${profile.id}`;
                
                const newUser = {
                  username,
                  email,
                  name: profile.displayName || username,
                  password: '', // لا نحتاج كلمة مرور للمصادقة الاجتماعية
                  provider: 'twitter',
                  providerId: profile.id,
                  providerData: profile,
                  profileImageUrl: profile.photos && profile.photos.length > 0
                    ? profile.photos[0].value
                    : null,
                  verifiedEmail: true,
                  role: 'user',
                  active: true
                };
                
                user = await storage.createUser(newUser);
              }
              
              // تحديث وقت آخر تسجيل دخول
              await storage.updateUser(user.id, { lastLogin: new Date() });
              
              return done(null, user);
            } catch (error) {
              return done(error);
            }
          })
        );
        console.log('Twitter authentication strategy configured');
      } else {
        console.log('Twitter authentication is disabled or missing configuration');
      }
    } catch (error) {
      console.error('Error setting up Twitter strategy:', error);
    }
  };
  
  // إعداد استراتيجية لينكدإن
  const setupLinkedInStrategy = async () => {
    try {
      const linkedinSettings = await storage.getAuthSettings('linkedin');
      if (linkedinSettings?.enabled && linkedinSettings.clientId && linkedinSettings.clientSecret) {
        passport.use(
          new LinkedInStrategy({
            clientID: linkedinSettings.clientId,
            clientSecret: linkedinSettings.clientSecret,
            callbackURL: linkedinSettings.redirectUri || '/auth/linkedin/callback',
            scope: linkedinSettings.scope?.split(',') || ['r_emailaddress', 'r_liteprofile']
          },
          async (accessToken, refreshToken, profile, done) => {
            try {
              // البحث عن المستخدم بمعرف المزود
              let user = await storage.getUserByProviderId('linkedin', profile.id);
              
              // إذا لم يتم العثور على المستخدم، ابحث عن طريق البريد الإلكتروني
              if (!user && profile.emails && profile.emails.length > 0) {
                const email = profile.emails[0].value;
                user = await storage.getUserByEmail(email);
                
                // إذا وجدنا مستخدم بنفس البريد الإلكتروني، قم بتحديث بيانات المزود
                if (user) {
                  user = await storage.updateUser(user.id, {
                    provider: 'linkedin',
                    providerId: profile.id,
                    providerData: profile
                  });
                }
              }
              
              // إذا لم يتم العثور على المستخدم، أنشئ حسابًا جديدًا
              if (!user) {
                const email = profile.emails && profile.emails.length > 0
                  ? profile.emails[0].value
                  : `${profile.id}@linkedin.user`;
                
                const username = profile.displayName 
                  ? profile.displayName.replace(/\s+/g, '_').toLowerCase()
                  : `user_${profile.id}`;
                
                const newUser = {
                  username,
                  email,
                  name: profile.displayName || username,
                  password: '', // لا نحتاج كلمة مرور للمصادقة الاجتماعية
                  provider: 'linkedin',
                  providerId: profile.id,
                  providerData: profile,
                  profileImageUrl: profile.photos && profile.photos.length > 0
                    ? profile.photos[0].value
                    : null,
                  verifiedEmail: true,
                  role: 'user',
                  active: true
                };
                
                user = await storage.createUser(newUser);
              }
              
              // تحديث وقت آخر تسجيل دخول
              await storage.updateUser(user.id, { lastLogin: new Date() });
              
              return done(null, user);
            } catch (error) {
              return done(error);
            }
          })
        );
        console.log('LinkedIn authentication strategy configured');
      } else {
        console.log('LinkedIn authentication is disabled or missing configuration');
      }
    } catch (error) {
      console.error('Error setting up LinkedIn strategy:', error);
    }
  };
  
  // تفعيل جميع استراتيجيات المصادقة
  setupGoogleStrategy();
  setupFacebookStrategy();
  setupTwitterStrategy();
  setupLinkedInStrategy();
  
  // مسارات المصادقة الاجتماعية
  // Google
  app.get('/auth/google', passport.authenticate('google'));
  app.get('/auth/google/callback', 
    passport.authenticate('google', { 
      failureRedirect: '/#/login?error=google_auth_failed' 
    }),
    (req, res) => {
      res.redirect('/#/');
    }
  );
  
  // Facebook
  app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));
  app.get('/auth/facebook/callback', 
    passport.authenticate('facebook', { 
      failureRedirect: '/#/login?error=facebook_auth_failed' 
    }),
    (req, res) => {
      res.redirect('/#/');
    }
  );
  
  // Twitter
  app.get('/auth/twitter', passport.authenticate('twitter'));
  app.get('/auth/twitter/callback', 
    passport.authenticate('twitter', { 
      failureRedirect: '/#/login?error=twitter_auth_failed' 
    }),
    (req, res) => {
      res.redirect('/#/');
    }
  );
  
  // LinkedIn
  app.get('/auth/linkedin', passport.authenticate('linkedin'));
  app.get('/auth/linkedin/callback', 
    passport.authenticate('linkedin', { 
      failureRedirect: '/#/login?error=linkedin_auth_failed' 
    }),
    (req, res) => {
      res.redirect('/#/');
    }
  );

  // طرق الوصول إلى إعدادات المصادقة (للمسؤولين فقط)
  app.get('/api/admin/auth-settings', isAdmin, async (req, res) => {
    try {
      const authSettings = await storage.getAllAuthSettings();
      // حذف البيانات الحساسة قبل الإرسال
      const safeSettings = authSettings.map(setting => {
        const { clientSecret, ...safeData } = setting;
        return {
          ...safeData,
          clientSecret: clientSecret ? '●●●●●●●●●●●●' : null
        };
      });
      res.json(safeSettings);
    } catch (error) {
      console.error('Error fetching auth settings:', error);
      res.status(500).json({ message: 'خطأ في الخادم' });
    }
  });
  
  // تحديث إعدادات المصادقة (للمسؤولين فقط)
  app.put('/api/admin/auth-settings/:provider', isAdmin, async (req, res) => {
    try {
      const { provider } = req.params;
      const {
        enabled,
        clientId,
        clientSecret,
        redirectUri,
        scope,
        additionalSettings
      } = req.body;
      
      // التأكد من وجود المزود
      const existingSettings = await storage.getAuthSettings(provider);
      if (!existingSettings) {
        return res.status(404).json({ message: 'المزود غير موجود' });
      }
      
      // تحديث الإعدادات
      const updatedSettings = await storage.updateAuthSettings(provider, {
        enabled,
        clientId,
        // فقط تحديث كلمة السر إذا تم تقديمها وليست مخفية (●●●●●●●●●●●●)
        ...(clientSecret && !clientSecret.includes('●') ? { clientSecret } : {}),
        redirectUri,
        scope,
        additionalSettings,
        updatedBy: req.user.id
      });
      
      if (!updatedSettings) {
        return res.status(500).json({ message: 'فشل تحديث الإعدادات' });
      }
      
      // إعادة تهيئة استراتيجيات المصادقة
      if (provider === 'google') setupGoogleStrategy();
      else if (provider === 'facebook') setupFacebookStrategy();
      else if (provider === 'twitter') setupTwitterStrategy();
      else if (provider === 'linkedin') setupLinkedInStrategy();
      
      // حذف البيانات الحساسة قبل الإرسال
      const { clientSecret: _, ...safeSettings } = updatedSettings;
      res.json({
        ...safeSettings,
        clientSecret: updatedSettings.clientSecret ? '●●●●●●●●●●●●' : null
      });
    } catch (error) {
      console.error('Error updating auth settings:', error);
      res.status(500).json({ message: 'خطأ في الخادم' });
    }
  });
  
  // Middleware for protected routes
  app.use("/api/admin/*", isAdmin);
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "الرجاء تسجيل الدخول للوصول إلى هذه الصفحة" });
}

// Middleware to check if user is admin
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "غير مصرح لك بالوصول إلى هذه الصفحة" });
}