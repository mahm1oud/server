import {
  users, type User, type InsertUser,
  categories, type Category, type InsertCategory,
  templates, type Template, type InsertTemplate,
  templateFields, type TemplateField, type InsertTemplateField,
  cards, type Card, type InsertCard,
  certificates, type Certificate, type InsertCertificate,
  certificateBatches, type CertificateBatch, type InsertCertificateBatch,
  certificateBatchItems, type CertificateBatchItem, type InsertCertificateBatchItem,
  fonts, type Font, type InsertFont,
  settings, type Setting, type InsertSetting,
  // الكيانات الجديدة
  layers, type Layer, type InsertLayer,
  userLogos, type UserLogo, type InsertUserLogo,
  userSignatures, type UserSignature, type InsertUserSignature,
  templateLogos, type TemplateLogo, type InsertTemplateLogo
} from "@shared/schema";

import { db } from "./db";
import { eq, and, desc, sql, like, asc, ilike, or, isNull } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";
import { randomBytes } from "crypto";
import { formatISO } from "date-fns";
import { hashPassword } from "./auth";

// Session store setup
const PostgresSessionStore = connectPg(session);
const sessionStore = new PostgresSessionStore({ 
  pool, 
  createTableIfMissing: true 
});

// تعريف واجهة لإعدادات المزودين الاجتماعيين
export interface AuthProviderSettings {
  id: number;
  provider: string;
  enabled: boolean;
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
  scope: string | null;
  additionalSettings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: number | null;
}

export interface IStorage {
  // Session store
  sessionStore: session.SessionStore;

  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByProviderId(provider: string, providerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(options?: { limit?: number; offset?: number; search?: string }): Promise<{ users: User[]; total: number }>;
  deleteUser(id: number): Promise<boolean>;
  
  // User Preferences methods
  getUserPreferences(userId: number): Promise<{layout?: string; theme?: string} | undefined>;
  saveUserPreferences(userId: number, preferences: {layout?: string; theme?: string}): Promise<boolean>;
  
  // Auth Provider Settings
  getAuthSettings(provider: string): Promise<AuthProviderSettings | undefined>;
  getAllAuthSettings(): Promise<AuthProviderSettings[]>;
  updateAuthSettings(provider: string, settings: Partial<AuthProviderSettings>): Promise<AuthProviderSettings | undefined>;
  
  // Category methods
  getAllCategories(options?: { active?: boolean }): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  getCategoryById(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Template methods
  getAllTemplates(options?: { active?: boolean; limit?: number; offset?: number; search?: string }): Promise<{ templates: Template[]; total: number }>;
  getTemplatesByCategory(categoryId: number, options?: { active?: boolean }): Promise<Template[]>;
  getTemplate(id: number): Promise<Template | undefined>;
  getTemplateBySlug(categorySlug: string, slug: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: number): Promise<boolean>;

  // Template Fields methods
  getTemplateFields(templateId: number): Promise<TemplateField[]>;
  getTemplateField(id: number): Promise<TemplateField | undefined>;
  createTemplateField(field: InsertTemplateField): Promise<TemplateField>;
  updateTemplateField(id: number, data: Partial<InsertTemplateField>): Promise<TemplateField | undefined>;
  deleteTemplateField(id: number): Promise<boolean>;

  // Card methods
  getCard(id: number): Promise<Card | undefined>;
  getCardByPublicId(publicId: string): Promise<Card | undefined>;
  getUserCards(userId: number, options?: { limit?: number; offset?: number }): Promise<{ cards: Card[]; total: number }>;
  createCard(card: InsertCard): Promise<Card>;
  updateCard(id: number, data: Partial<InsertCard>): Promise<Card | undefined>;
  deleteCard(id: number): Promise<boolean>;

  // Certificate methods
  getCertificate(id: number): Promise<Certificate | undefined>;
  getCertificateByPublicId(publicId: string): Promise<Certificate | undefined>;
  getCertificateByVerificationCode(code: string): Promise<Certificate | undefined>;
  getUserCertificates(userId: number, options?: { limit?: number; offset?: number; type?: string }): Promise<{ certificates: Certificate[]; total: number }>;
  createCertificate(cert: InsertCertificate): Promise<Certificate>;
  updateCertificate(id: number, data: Partial<InsertCertificate>): Promise<Certificate | undefined>;
  deleteCertificate(id: number): Promise<boolean>;

  // Batch Certificate methods
  getCertificateBatch(id: number): Promise<CertificateBatch | undefined>;
  getUserCertificateBatches(userId: number, options?: { limit?: number; offset?: number }): Promise<{ batches: CertificateBatch[]; total: number }>;
  createCertificateBatch(batch: InsertCertificateBatch): Promise<CertificateBatch>;
  updateCertificateBatch(id: number, data: Partial<InsertCertificateBatch>): Promise<CertificateBatch | undefined>;
  deleteCertificateBatch(id: number): Promise<boolean>;
  
  // Batch Certificate Items methods
  getBatchItem(id: number): Promise<CertificateBatchItem | undefined>;
  getBatchItems(batchId: number, options?: { limit?: number; offset?: number; status?: string }): Promise<{ items: CertificateBatchItem[]; total: number }>;
  createBatchItem(item: InsertCertificateBatchItem): Promise<CertificateBatchItem>;
  updateBatchItem(id: number, data: Partial<InsertCertificateBatchItem>): Promise<CertificateBatchItem | undefined>;
  deleteBatchItem(id: number): Promise<boolean>;

  // Font methods
  getAllFonts(options?: { active?: boolean }): Promise<Font[]>;
  getFont(id: number): Promise<Font | undefined>;
  createFont(font: InsertFont): Promise<Font>;
  updateFont(id: number, data: Partial<InsertFont>): Promise<Font | undefined>;
  deleteFont(id: number): Promise<boolean>;

  // Settings methods
  getSetting(key: string): Promise<Setting | undefined>;
  getSettingsByCategory(category: string): Promise<Setting[]>;
  createOrUpdateSetting(setting: InsertSetting): Promise<Setting>;
  deleteSetting(key: string): Promise<boolean>;
  
  // Layers methods - طبقات العناصر
  getLayers(templateId: number): Promise<Layer[]>;
  getLayer(id: number): Promise<Layer | undefined>;
  createLayer(layer: InsertLayer): Promise<Layer>;
  updateLayer(id: number, data: Partial<InsertLayer>): Promise<Layer | undefined>;
  deleteLayer(id: number): Promise<boolean>;
  reorderLayers(templateId: number, layerIds: number[]): Promise<boolean>;
  
  // Template Logos methods - شعارات القوالب
  getTemplateLogos(templateId: number): Promise<TemplateLogo[]>;
  getTemplateLogo(id: number): Promise<TemplateLogo | undefined>;
  createTemplateLogo(logo: InsertTemplateLogo): Promise<TemplateLogo>;
  updateTemplateLogo(id: number, data: Partial<InsertTemplateLogo>): Promise<TemplateLogo | undefined>;
  deleteTemplateLogo(id: number): Promise<boolean>;
  
  // User Logos methods - شعارات المستخدم
  getUserLogos(userId: number): Promise<UserLogo[]>;
  getUserLogo(id: number): Promise<UserLogo | undefined>;
  createUserLogo(logo: InsertUserLogo): Promise<UserLogo>;
  updateUserLogo(id: number, data: Partial<InsertUserLogo>): Promise<UserLogo | undefined>;
  deleteUserLogo(id: number): Promise<boolean>;
  
  // User Signatures methods - توقيعات المستخدم
  getUserSignatures(userId: number, type?: string): Promise<UserSignature[]>;
  getUserSignature(id: number): Promise<UserSignature | undefined>;
  createUserSignature(signature: InsertUserSignature): Promise<UserSignature>;
  updateUserSignature(id: number, data: Partial<InsertUserSignature>): Promise<UserSignature | undefined>;
  deleteUserSignature(id: number): Promise<boolean>;
  
  // System Settings methods - إعدادات النظام
  getSettings(category: string): Promise<any>;
  updateSettings(category: string, settings: any): Promise<boolean>;
  getSettingValue(category: string, key: string): Promise<any>;
  updateSettingValue(category: string, key: string, value: any): Promise<boolean>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = sessionStore;
    this.initializeData();
  }

  // Initialize with sample data if empty
  private async initializeData() {
    try {
      // Check if categories exist
      const existingCategories = await db.select().from(categories).limit(1);
      
      if (existingCategories.length === 0) {
        console.log("Initializing database with sample data...");
        
        // Add sample categories
        const categoriesData: InsertCategory[] = [
          { 
            name: 'دعوات زفاف', 
            nameAr: 'دعوات زفاف', 
            slug: 'wedding', 
            displayOrder: 1, 
            description: 'دعوات زفاف متنوعة', 
            descriptionAr: 'دعوات زفاف متنوعة',
            active: true,
            icon: '💍'
          },
          { 
            name: 'دعوات خطوبة', 
            nameAr: 'دعوات خطوبة', 
            slug: 'engagement', 
            displayOrder: 2, 
            description: 'دعوات خطوبة متنوعة', 
            descriptionAr: 'دعوات خطوبة متنوعة',
            active: true,
            icon: '💑'
          },
          { 
            name: 'تهنئة تخرج', 
            nameAr: 'تهنئة تخرج', 
            slug: 'graduation', 
            displayOrder: 3, 
            description: 'شهادات وبطاقات تخرج', 
            descriptionAr: 'شهادات وبطاقات تخرج',
            active: true,
            icon: '🎓'
          },
          { 
            name: 'بطاقات عيد', 
            nameAr: 'بطاقات عيد', 
            slug: 'eid', 
            displayOrder: 4, 
            description: 'بطاقات عيد الفطر والأضحى', 
            descriptionAr: 'بطاقات عيد الفطر والأضحى',
            active: true,
            icon: '🎉'
          },
          { 
            name: 'بطاقات رمضانية', 
            nameAr: 'بطاقات رمضانية', 
            slug: 'ramadan', 
            displayOrder: 5, 
            description: 'بطاقات تهنئة رمضان كريم', 
            descriptionAr: 'بطاقات تهنئة رمضان كريم',
            active: true,
            icon: '🌙'
          },
          { 
            name: 'شهادات شكر وتقدير', 
            nameAr: 'شهادات شكر وتقدير', 
            slug: 'certificates', 
            displayOrder: 6, 
            description: 'شهادات شكر وتقدير متنوعة', 
            descriptionAr: 'شهادات شكر وتقدير متنوعة',
            active: true,
            icon: '📜'
          }
        ];
        
        // Insert categories
        for (const category of categoriesData) {
          await this.createCategory(category);
        }
        
        // Add admin user with the required password (700700)
        const hashedPassword = await hashPassword('700700');
        
        const adminUser: InsertUser = {
          username: 'admin',
          password: hashedPassword,
          email: 'admin@example.com',
          name: 'مدير النظام',
          role: 'admin',
          active: true
        };
        
        await this.createUser(adminUser);
        
        // Add sample templates (after retrieving the category IDs)
        const weddingCategory = await this.getCategoryBySlug('wedding');
        const eidCategory = await this.getCategoryBySlug('eid');
        const ramadanCategory = await this.getCategoryBySlug('ramadan');
        const graduationCategory = await this.getCategoryBySlug('graduation');
        const engagementCategory = await this.getCategoryBySlug('engagement');
        const certificatesCategory = await this.getCategoryBySlug('certificates');
        
        if (weddingCategory && eidCategory && ramadanCategory && graduationCategory && engagementCategory && certificatesCategory) {
          // Add sample templates
          const templatesData: InsertTemplate[] = [
            {
              title: 'دعوة زفاف كلاسيكية',
              titleAr: 'دعوة زفاف كلاسيكية',
              slug: 'Wedding11',
              categoryId: weddingCategory.id,
              imageUrl: '/static/wedding-template.svg',
              displayOrder: 1,
              fields: ['groomName', 'brideName', 'weddingDate', 'weddingTime', 'weddingLocation', 'additionalNotes'],
              defaultValues: {
                additionalNotes: 'بكل الحب والتقدير\nأتشرف بدعوتكم لحضور\nحفل زواجي وتناول طعام العشاء\nيوم الجمعة \nالموافق ١٤٤٣/١٠/١٩ هـ\nقاعة فــرح\nجدة - شارع الجامعة'
              },
              active: true,
              settings: {
                fontFamily: 'Tajawal',
                fontSize: 18,
                textColor: '#000000',
                backgroundColor: '#ffffff'
              }
            },
            {
              title: 'بطاقة رمضانية',
              titleAr: 'بطاقة رمضانية',
              slug: 'Ramadan2',
              categoryId: ramadanCategory.id,
              imageUrl: '/static/ramadan-template.svg',
              displayOrder: 1,
              fields: ['sender', 'recipient', 'message', 'userImage'],
              defaultValues: {},
              active: true,
              settings: {
                fontFamily: 'Tajawal',
                fontSize: 16,
                textColor: '#ffffff',
                backgroundColor: '#002C59'
              }
            },
            {
              title: 'بطاقة عيد',
              titleAr: 'بطاقة عيد',
              slug: 'Eid4',
              categoryId: eidCategory.id,
              imageUrl: '/static/eid-template.svg',
              displayOrder: 1,
              fields: ['sender', 'recipient', 'message', 'eidType', 'userImage'],
              defaultValues: {},
              active: true,
              settings: {
                fontFamily: 'Tajawal',
                fontSize: 16,
                textColor: '#5E35B1',
                backgroundColor: '#ffffff'
              }
            },
            {
              title: 'شهادة شكر وتقدير',
              titleAr: 'شهادة شكر وتقدير',
              slug: 'Certificate1',
              categoryId: certificatesCategory.id,
              imageUrl: '/static/certificate-template.svg',
              displayOrder: 1,
              fields: [
                'issuedTo', 'issuedToGender', 'schoolName', 'reason', 'date', 
                'principalTitle', 'principalName', 'secondaryTitle', 'secondaryName',
                'thirdTitle', 'thirdName', 'certificateType', 'logo1', 'logo2', 'logo3'
              ],
              defaultValues: {
                reason: 'وذلك نظير جهوده في تفعيل أنشطة اليوم الوطني 93 للمملكة العربية السعودية\nوبدورنا نقدم له هذا الشكر كتقدير لجهوده المبذولة\nسائلين الله له مزيدًا من التفوق والنجاح',
                principalTitle: 'مدير المدرسة',
                secondaryTitle: 'المشرف التربوي',
                thirdTitle: 'رائد النشاط'
              },
              active: true,
              settings: {
                fontFamily: 'Tajawal',
                certificateFontFamily: 'DecoType Naskh',
                fontSize: 18,
                textColor: '#000000',
                backgroundColor: '#ffffff',
                borderColor: '#D4AF37',
                borderWidth: 10
              }
            }
          ];
          
          // Insert templates
          for (const template of templatesData) {
            await this.createTemplate(template);
          }
          
          // Add some fonts
          const fontsData: InsertFont[] = [
            {
              name: 'Tajawal',
              nameAr: 'تجول',
              family: 'Tajawal, sans-serif',
              type: 'google',
              url: 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap',
              active: true,
              isRtl: true,
              displayOrder: 1
            },
            {
              name: 'Cairo',
              nameAr: 'القاهرة',
              family: 'Cairo, sans-serif',
              type: 'google',
              url: 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
              active: true,
              isRtl: true,
              displayOrder: 2
            },
            {
              name: 'Amiri',
              nameAr: 'أميري',
              family: 'Amiri, serif',
              type: 'google',
              url: 'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap',
              active: true,
              isRtl: true,
              displayOrder: 3
            },
            {
              name: 'Lateef',
              nameAr: 'لطيف',
              family: 'Lateef, cursive',
              type: 'google',
              url: 'https://fonts.googleapis.com/css2?family=Lateef&display=swap',
              active: true,
              isRtl: true,
              displayOrder: 4
            },
            {
              name: 'DecoType Naskh',
              nameAr: 'ديكو تايب نسخ',
              family: 'DecoType Naskh',
              type: 'custom',
              active: true,
              isRtl: true,
              displayOrder: 5
            }
          ];
          
          // Insert fonts
          for (const font of fontsData) {
            await this.createFont(font);
          }
        }
      }
    } catch (error) {
      console.error("Error initializing data:", error);
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async getUserByProviderId(provider: string, providerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.provider, provider),
        eq(users.providerId, providerId)
      )
    );
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getAllUsers(options: { limit?: number; offset?: number; search?: string } = {}): Promise<{ users: User[]; total: number }> {
    const { limit = 100, offset = 0, search = '' } = options;
    
    let query = db.select().from(users);
    
    if (search) {
      query = query.where(
        or(
          like(users.username, `%${search}%`),
          like(users.name || '', `%${search}%`),
          like(users.email, `%${search}%`)
        )
      );
    }
    
    const usersData = await query.limit(limit).offset(offset).orderBy(desc(users.id));
    
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(search ? or(
        like(users.username, `%${search}%`),
        like(users.name || '', `%${search}%`),
        like(users.email, `%${search}%`)
      ) : sql`1=1`);
    
    return { users: usersData, total: Number(count) };
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return !!result;
  }

  // User Preferences methods
  async getUserPreferences(userId: number): Promise<{layout?: string; theme?: string} | undefined> {
    try {
      // Since user preferences are stored as settings, we need to use direct SQL queries
      // because the settings table structure doesn't match our schema definition
      const query = `
        SELECT key, value
        FROM settings
        WHERE category = 'user_preferences'
        AND (key = $1 OR key = $2)
      `;
      
      const result = await pool.query(query, [`user_${userId}_layout`, `user_${userId}_theme`]);
      
      if (!result.rows || result.rows.length === 0) {
        return { layout: 'boxed', theme: 'light' }; // Default values
      }
      
      // Create an object with the user preferences
      const preferences: {layout?: string; theme?: string} = {
        layout: 'boxed',  // Default
        theme: 'light'   // Default
      };
      
      for (const row of result.rows) {
        try {
          if (row.key === `user_${userId}_layout`) {
            // Check if value is already a string or try to parse it as JSON
            preferences.layout = typeof row.value === 'string' ? 
              (row.value.startsWith('"') ? JSON.parse(row.value) : row.value) : 
              row.value;
          } else if (row.key === `user_${userId}_theme`) {
            preferences.theme = typeof row.value === 'string' ? 
              (row.value.startsWith('"') ? JSON.parse(row.value) : row.value) : 
              row.value;
          }
        } catch (error) {
          console.error(`Error parsing preference value for ${row.key}:`, error);
          // If parsing fails, use the raw value as a fallback
          if (row.key === `user_${userId}_layout`) {
            preferences.layout = row.value;
          } else if (row.key === `user_${userId}_theme`) {
            preferences.theme = row.value;
          }
        }
      }
      
      return preferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return { layout: 'boxed', theme: 'light' }; // Return defaults on error
    }
  }

  async saveUserPreferences(userId: number, preferences: {layout?: string; theme?: string}): Promise<boolean> {
    try {
      // For each preference, create or update a setting using direct SQL
      // since the settings table structure doesn't match our schema definition
      if (preferences.layout) {
        const layoutQuery = `
          INSERT INTO settings (key, value, category, description, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (category, key) 
          DO UPDATE SET 
            value = $2,
            updated_at = NOW()
        `;
        
        await pool.query(
          layoutQuery, 
          [
            `user_${userId}_layout`, 
            JSON.stringify(preferences.layout),
            'user_preferences',
            'User layout preference'
          ]
        );
      }
      
      if (preferences.theme) {
        const themeQuery = `
          INSERT INTO settings (key, value, category, description, updated_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (category, key) 
          DO UPDATE SET 
            value = $2,
            updated_at = NOW()
        `;
        
        await pool.query(
          themeQuery, 
          [
            `user_${userId}_theme`,
            JSON.stringify(preferences.theme),
            'user_preferences',
            'User theme preference'
          ]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error saving user preferences:', error);
      return false;
    }
  }

  // Auth Provider Settings methods
  async getAuthSettings(provider: string): Promise<AuthProviderSettings | undefined> {
    const query = `
      SELECT * FROM auth_settings
      WHERE provider = $1
      LIMIT 1
    `;
    
    try {
      const result = await pool.query(query, [provider]);
      return result.rows[0];
    } catch (error) {
      console.error('Error fetching auth settings:', error);
      return undefined;
    }
  }
  
  async getAllAuthSettings(): Promise<AuthProviderSettings[]> {
    const query = `
      SELECT * FROM auth_settings
      ORDER BY provider
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching all auth settings:', error);
      return [];
    }
  }
  
  async updateAuthSettings(provider: string, settings: Partial<AuthProviderSettings>): Promise<AuthProviderSettings | undefined> {
    const { clientId, clientSecret, redirectUri, scope, enabled, additionalSettings, updatedBy } = settings;
    
    const query = `
      UPDATE auth_settings 
      SET 
        client_id = COALESCE($1, client_id),
        client_secret = COALESCE($2, client_secret),
        redirect_uri = COALESCE($3, redirect_uri),
        scope = COALESCE($4, scope),
        enabled = COALESCE($5, enabled),
        additional_settings = COALESCE($6, additional_settings),
        updated_by = COALESCE($7, updated_by),
        updated_at = NOW()
      WHERE provider = $8
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [
        clientId,
        clientSecret, 
        redirectUri,
        scope,
        enabled,
        additionalSettings || {},
        updatedBy,
        provider
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating auth settings:', error);
      return undefined;
    }
  }

  // Category methods
  async getAllCategories(options: { active?: boolean } = {}): Promise<Category[]> {
    const { active } = options;
    
    let query = db.select().from(categories);
    
    if (active !== undefined) {
      query = query.where(eq(categories.active, active));
    }
    
    return query.orderBy(asc(categories.displayOrder));
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  async updateCategory(id: number, data: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updatedCategory] = await db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return !!result;
  }

  // Template methods
  async getAllTemplates(options: { active?: boolean; limit?: number; offset?: number; search?: string } = {}): Promise<{ templates: Template[]; total: number }> {
    const { active, limit = 100, offset = 0, search = '' } = options;
    
    let query = db.select().from(templates);
    
    if (active !== undefined) {
      query = query.where(eq(templates.active, active));
    }
    
    if (search) {
      query = query.where(
        or(
          like(templates.title, `%${search}%`),
          like(templates.titleAr || '', `%${search}%`)
        )
      );
    }
    
    const templatesData = await query
      .limit(limit)
      .offset(offset)
      .orderBy(asc(templates.categoryId), asc(templates.displayOrder));
    
    // Get total count
    const conditions = [];
    if (active !== undefined) {
      conditions.push(eq(templates.active, active));
    }
    if (search) {
      conditions.push(
        or(
          like(templates.title, `%${search}%`),
          like(templates.titleAr || '', `%${search}%`)
        )
      );
    }
    
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(templates)
      .where(conditions.length ? and(...conditions) : sql`1=1`);
    
    return { templates: templatesData, total: Number(count) };
  }

  async getTemplatesByCategory(categoryId: number, options: { active?: boolean } = {}): Promise<Template[]> {
    const { active } = options;
    
    let query = db.select().from(templates).where(eq(templates.categoryId, categoryId));
    
    if (active !== undefined) {
      query = query.where(eq(templates.active, active));
    }
    
    return query.orderBy(asc(templates.displayOrder));
  }

  async getTemplate(id: number): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template;
  }

  async getTemplateBySlug(categorySlug: string, idOrSlug: string): Promise<Template | undefined> {
    console.log(`getTemplateBySlug - categorySlug: ${categorySlug}, idOrSlug: ${idOrSlug}`);
    const category = await this.getCategoryBySlug(categorySlug);
    if (!category) {
      console.log(`Category with slug ${categorySlug} not found`);
      return undefined;
    }
    
    console.log(`Category found: ${category.name}, ID: ${category.id}`);
    
    // إذا كان المعرف رقميًا، جرِّب البحث أولاً بالمعرف
    if (!isNaN(Number(idOrSlug))) {
      const templateId = Number(idOrSlug);
      console.log(`Searching for template by ID: ${templateId} in category ${category.name}`);
      
      // جرب البحث عن قالب بمعرف محدد ضمن الفئة
      const [templateById] = await db
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.categoryId, category.id),
            eq(templates.id, templateId)
          )
        );
      
      if (templateById) {
        console.log(`Template found by ID: ${templateById.title}, ID: ${templateById.id}`);
        return templateById;
      }
      
      // إذا لم يتم العثور على قالب بالمعرف في الفئة، ابحث عن أي قالب بهذا المعرف
      const template = await this.getTemplate(templateId);
      if (template) {
        console.log(`Template found by ID (any category): ${template.title}, ID: ${template.id}`);
        return template;
      }
    }
    
    // إذا لم يكن معرفًا رقميًا أو لم يتم العثور على قالب بالمعرف، جرِّب البحث باستخدام slug
    console.log(`Searching for template by slug: ${idOrSlug} in category ${category.name}`);
    const [templateBySlug] = await db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.categoryId, category.id),
          eq(templates.slug, idOrSlug)
        )
      );
    
    if (templateBySlug) {
      console.log(`Template found by slug: ${templateBySlug.title}, ID: ${templateBySlug.id}`);
      return templateBySlug;
    }
    
    console.log(`No template found for category: ${categorySlug}, idOrSlug: ${idOrSlug}`);
    return undefined;
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const [template] = await db.insert(templates).values(insertTemplate).returning();
    return template;
  }

  async updateTemplate(id: number, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [updatedTemplate] = await db
      .update(templates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(templates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteTemplate(id: number): Promise<boolean> {
    const result = await db.delete(templates).where(eq(templates.id, id));
    return !!result;
  }

  // Template Fields methods
  async getTemplateFields(templateId: number): Promise<TemplateField[]> {
    return db
      .select()
      .from(templateFields)
      .where(eq(templateFields.templateId, templateId))
      .orderBy(asc(templateFields.displayOrder));
  }
  
  async getAllTemplateFields(): Promise<TemplateField[]> {
    return db
      .select()
      .from(templateFields)
      .orderBy(asc(templateFields.templateId), asc(templateFields.displayOrder));
  }

  async getTemplateField(id: number): Promise<TemplateField | undefined> {
    const [field] = await db.select().from(templateFields).where(eq(templateFields.id, id));
    return field;
  }

  async createTemplateField(insertField: InsertTemplateField): Promise<TemplateField> {
    const [field] = await db.insert(templateFields).values(insertField).returning();
    return field;
  }

  async updateTemplateField(id: number, data: Partial<InsertTemplateField>): Promise<TemplateField | undefined> {
    const [updatedField] = await db
      .update(templateFields)
      .set(data)
      .where(eq(templateFields.id, id))
      .returning();
    return updatedField;
  }

  async deleteTemplateField(id: number): Promise<boolean> {
    const result = await db.delete(templateFields).where(eq(templateFields.id, id));
    return !!result;
  }

  // Card methods
  async getCard(id: number): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card;
  }

  async getCardByPublicId(publicId: string): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.publicId, publicId));
    return card;
  }

  async getUserCards(userId: number, options: { limit?: number; offset?: number } = {}): Promise<{ cards: Card[]; total: number }> {
    const { limit = 100, offset = 0 } = options;
    
    const cardsData = await db
      .select()
      .from(cards)
      .where(eq(cards.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(cards.createdAt));
    
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cards)
      .where(eq(cards.userId, userId));
    
    return { cards: cardsData, total: Number(count) };
  }

  async createCard(insertCard: InsertCard): Promise<Card> {
    // If no publicId is provided, generate one
    if (!insertCard.publicId) {
      insertCard.publicId = randomBytes(8).toString('hex');
    }
    
    const [card] = await db.insert(cards).values(insertCard).returning();
    return card;
  }

  async updateCard(id: number, data: Partial<InsertCard>): Promise<Card | undefined> {
    const [updatedCard] = await db
      .update(cards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cards.id, id))
      .returning();
    return updatedCard;
  }

  async deleteCard(id: number): Promise<boolean> {
    const result = await db.delete(cards).where(eq(cards.id, id));
    return !!result;
  }

  // Certificate methods
  async getCertificate(id: number): Promise<Certificate | undefined> {
    const [certificate] = await db.select().from(certificates).where(eq(certificates.id, id));
    return certificate;
  }

  async getCertificateByPublicId(publicId: string): Promise<Certificate | undefined> {
    const [certificate] = await db.select().from(certificates).where(eq(certificates.publicId, publicId));
    return certificate;
  }

  async getCertificateByVerificationCode(code: string): Promise<Certificate | undefined> {
    const [certificate] = await db.select().from(certificates).where(eq(certificates.verificationCode, code));
    return certificate;
  }

  async getUserCertificates(userId: number, options: { limit?: number; offset?: number; type?: string } = {}): Promise<{ certificates: Certificate[]; total: number }> {
    const { limit = 100, offset = 0, type } = options;
    
    let query = db.select().from(certificates).where(eq(certificates.userId, userId));
    
    if (type) {
      query = query.where(eq(certificates.certificateType, type));
    }
    
    const certificatesData = await query
      .limit(limit)
      .offset(offset)
      .orderBy(desc(certificates.createdAt));
    
    // Get total count
    const conditions = [eq(certificates.userId, userId)];
    if (type) {
      conditions.push(eq(certificates.certificateType, type));
    }
    
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(certificates)
      .where(and(...conditions));
    
    return { certificates: certificatesData, total: Number(count) };
  }

  async createCertificate(insertCertificate: InsertCertificate): Promise<Certificate> {
    // If no publicId or verificationCode is provided, generate them
    if (!insertCertificate.publicId) {
      insertCertificate.publicId = randomBytes(8).toString('hex');
    }
    
    if (!insertCertificate.verificationCode) {
      insertCertificate.verificationCode = randomBytes(4).toString('hex').toUpperCase();
    }
    
    const [certificate] = await db.insert(certificates).values(insertCertificate).returning();
    return certificate;
  }

  async updateCertificate(id: number, data: Partial<InsertCertificate>): Promise<Certificate | undefined> {
    const [updatedCertificate] = await db
      .update(certificates)
      .set(data)
      .where(eq(certificates.id, id))
      .returning();
    return updatedCertificate;
  }

  async deleteCertificate(id: number): Promise<boolean> {
    const result = await db.delete(certificates).where(eq(certificates.id, id));
    return !!result;
  }

  // Batch Certificate methods
  async getCertificateBatch(id: number): Promise<CertificateBatch | undefined> {
    const [batch] = await db.select().from(certificateBatches).where(eq(certificateBatches.id, id));
    return batch;
  }

  async getUserCertificateBatches(userId: number, options: { limit?: number; offset?: number } = {}): Promise<{ batches: CertificateBatch[]; total: number }> {
    const { limit = 100, offset = 0 } = options;
    
    const batchesData = await db
      .select()
      .from(certificateBatches)
      .where(eq(certificateBatches.userId, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(certificateBatches.createdAt));
    
    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(certificateBatches)
      .where(eq(certificateBatches.userId, userId));
    
    return { batches: batchesData, total: Number(count) };
  }

  async createCertificateBatch(insertBatch: InsertCertificateBatch): Promise<CertificateBatch> {
    const [batch] = await db.insert(certificateBatches).values(insertBatch).returning();
    return batch;
  }

  async updateCertificateBatch(id: number, data: Partial<InsertCertificateBatch>): Promise<CertificateBatch | undefined> {
    const [updatedBatch] = await db
      .update(certificateBatches)
      .set(data)
      .where(eq(certificateBatches.id, id))
      .returning();
    return updatedBatch;
  }

  async deleteCertificateBatch(id: number): Promise<boolean> {
    const result = await db.delete(certificateBatches).where(eq(certificateBatches.id, id));
    return !!result;
  }

  // Batch Certificate Items methods
  async getBatchItem(id: number): Promise<CertificateBatchItem | undefined> {
    const [item] = await db.select().from(certificateBatchItems).where(eq(certificateBatchItems.id, id));
    return item;
  }

  async getBatchItems(batchId: number, options: { limit?: number; offset?: number; status?: string } = {}): Promise<{ items: CertificateBatchItem[]; total: number }> {
    const { limit = 100, offset = 0, status } = options;
    
    let query = db.select().from(certificateBatchItems).where(eq(certificateBatchItems.batchId, batchId));
    
    if (status) {
      query = query.where(eq(certificateBatchItems.status, status));
    }
    
    const itemsData = await query
      .limit(limit)
      .offset(offset)
      .orderBy(asc(certificateBatchItems.rowNumber));
    
    // Get total count
    const conditions = [eq(certificateBatchItems.batchId, batchId)];
    if (status) {
      conditions.push(eq(certificateBatchItems.status, status));
    }
    
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(certificateBatchItems)
      .where(and(...conditions));
    
    return { items: itemsData, total: Number(count) };
  }

  async createBatchItem(insertItem: InsertCertificateBatchItem): Promise<CertificateBatchItem> {
    const [item] = await db.insert(certificateBatchItems).values(insertItem).returning();
    return item;
  }

  async updateBatchItem(id: number, data: Partial<InsertCertificateBatchItem>): Promise<CertificateBatchItem | undefined> {
    const [updatedItem] = await db
      .update(certificateBatchItems)
      .set(data)
      .where(eq(certificateBatchItems.id, id))
      .returning();
    return updatedItem;
  }

  async deleteBatchItem(id: number): Promise<boolean> {
    const result = await db.delete(certificateBatchItems).where(eq(certificateBatchItems.id, id));
    return !!result;
  }

  // Font methods
  async getAllFonts(options: { active?: boolean } = {}): Promise<Font[]> {
    const { active } = options;
    
    let query = db.select().from(fonts);
    
    if (active !== undefined) {
      query = query.where(eq(fonts.active, active));
    }
    
    return query.orderBy(asc(fonts.displayOrder));
  }

  async getFont(id: number): Promise<Font | undefined> {
    const [font] = await db.select().from(fonts).where(eq(fonts.id, id));
    return font;
  }

  async createFont(insertFont: InsertFont): Promise<Font> {
    const [font] = await db.insert(fonts).values(insertFont).returning();
    return font;
  }

  async updateFont(id: number, data: Partial<InsertFont>): Promise<Font | undefined> {
    const [updatedFont] = await db
      .update(fonts)
      .set(data)
      .where(eq(fonts.id, id))
      .returning();
    return updatedFont;
  }

  async deleteFont(id: number): Promise<boolean> {
    const result = await db.delete(fonts).where(eq(fonts.id, id));
    return !!result;
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async getSettingsByCategory(category: string): Promise<Setting[]> {
    return db
      .select()
      .from(settings)
      .where(eq(settings.category, category))
      .orderBy(asc(settings.key));
  }

  async createOrUpdateSetting(insertSetting: InsertSetting): Promise<Setting> {
    // Check if setting exists
    const existingSetting = await this.getSetting(insertSetting.key);
    
    if (existingSetting) {
      // Update
      const [updatedSetting] = await db
        .update(settings)
        .set({ ...insertSetting, updatedAt: new Date() })
        .where(eq(settings.key, insertSetting.key))
        .returning();
      
      return updatedSetting;
    } else {
      // Create
      const [setting] = await db.insert(settings).values(insertSetting).returning();
      return setting;
    }
  }

  async deleteSetting(key: string): Promise<boolean> {
    const result = await db.delete(settings).where(eq(settings.key, key));
    return !!result;
  }
  
  // Get all cards
  async getAllCards(options: { limit?: number; offset?: number; search?: string; status?: string } = {}): Promise<{ cards: Card[]; total: number }> {
    try {
      const { limit, offset, search, status } = options;
      
      let query = db.select().from(cards);
      let countQuery = db.select({ count: sql<number>`count(*)` }).from(cards);
      
      if (status) {
        query = query.where(eq(cards.status, status));
        countQuery = countQuery.where(eq(cards.status, status));
      }
      
      if (search) {
        query = query.where(sql`LOWER(cards.title) LIKE ${`%${search.toLowerCase()}%`}`);
        countQuery = countQuery.where(sql`LOWER(cards.title) LIKE ${`%${search.toLowerCase()}%`}`);
      }
      
      if (limit) {
        query = query.limit(limit);
      }
      
      if (offset) {
        query = query.offset(offset);
      }
      
      query = query.orderBy(desc(cards.createdAt));
      
      const result = await query;
      const countResult = await countQuery;
      
      return {
        cards: result,
        total: Number(countResult[0]?.count || 0)
      };
    } catch (error) {
      console.error("Error getting all cards:", error);
      return { cards: [], total: 0 };
    }
  }
  
  // Get all certificates
  async getAllCertificates(options: { limit?: number; offset?: number; search?: string; type?: string } = {}): Promise<{ certificates: Certificate[]; total: number }> {
    try {
      const { limit, offset, search, type } = options;
      
      let query = db.select().from(certificates);
      let countQuery = db.select({ count: sql<number>`count(*)` }).from(certificates);
      
      if (type) {
        query = query.where(eq(certificates.certificateType, type));
        countQuery = countQuery.where(eq(certificates.certificateType, type));
      }
      
      if (search) {
        query = query.where(sql`LOWER(certificates.title) LIKE ${`%${search.toLowerCase()}%`}`);
        countQuery = countQuery.where(sql`LOWER(certificates.title) LIKE ${`%${search.toLowerCase()}%`}`);
      }
      
      if (limit) {
        query = query.limit(limit);
      }
      
      if (offset) {
        query = query.offset(offset);
      }
      
      query = query.orderBy(desc(certificates.createdAt));
      
      const result = await query;
      const countResult = await countQuery;
      
      return {
        certificates: result,
        total: Number(countResult[0]?.count || 0)
      };
    } catch (error) {
      console.error("Error getting all certificates:", error);
      return { certificates: [], total: 0 };
    }
  }

  // ========================
  // طبقات العناصر - Layers
  // ========================

  async getLayers(templateId: number): Promise<Layer[]> {
    try {
      const layersList = await db.select().from(layers)
        .where(eq(layers.templateId, templateId))
        .orderBy(asc(layers.zIndex));
      return layersList;
    } catch (error) {
      console.error("Error fetching layers:", error);
      return [];
    }
  }

  async getLayer(id: number): Promise<Layer | undefined> {
    try {
      const [layer] = await db.select().from(layers).where(eq(layers.id, id));
      return layer;
    } catch (error) {
      console.error("Error fetching layer:", error);
      return undefined;
    }
  }

  async createLayer(layer: InsertLayer): Promise<Layer> {
    try {
      const [newLayer] = await db.insert(layers).values(layer).returning();
      return newLayer;
    } catch (error) {
      console.error("Error creating layer:", error);
      throw error;
    }
  }

  async updateLayer(id: number, data: Partial<InsertLayer>): Promise<Layer | undefined> {
    try {
      const [updatedLayer] = await db.update(layers)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(layers.id, id))
        .returning();
      return updatedLayer;
    } catch (error) {
      console.error("Error updating layer:", error);
      return undefined;
    }
  }

  async deleteLayer(id: number): Promise<boolean> {
    try {
      const result = await db.delete(layers).where(eq(layers.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting layer:", error);
      return false;
    }
  }

  async reorderLayers(templateId: number, layerIds: number[]): Promise<boolean> {
    try {
      // Transaction to reorder all layers
      await db.transaction(async (tx) => {
        for (let i = 0; i < layerIds.length; i++) {
          await tx.update(layers)
            .set({ zIndex: i })
            .where(and(
              eq(layers.id, layerIds[i]),
              eq(layers.templateId, templateId)
            ));
        }
      });
      return true;
    } catch (error) {
      console.error("Error reordering layers:", error);
      return false;
    }
  }

  // ==============================
  // شعارات القوالب - Template Logos
  // ==============================

  async getTemplateLogos(templateId: number): Promise<TemplateLogo[]> {
    try {
      const logosList = await db.select().from(templateLogos)
        .where(eq(templateLogos.templateId, templateId))
        .orderBy(asc(templateLogos.displayOrder));
      return logosList;
    } catch (error) {
      console.error("Error fetching template logos:", error);
      return [];
    }
  }

  async getTemplateLogo(id: number): Promise<TemplateLogo | undefined> {
    try {
      const [logo] = await db.select().from(templateLogos).where(eq(templateLogos.id, id));
      return logo;
    } catch (error) {
      console.error("Error fetching template logo:", error);
      return undefined;
    }
  }

  async createTemplateLogo(logo: InsertTemplateLogo): Promise<TemplateLogo> {
    try {
      const [newLogo] = await db.insert(templateLogos).values(logo).returning();
      return newLogo;
    } catch (error) {
      console.error("Error creating template logo:", error);
      throw error;
    }
  }

  async updateTemplateLogo(id: number, data: Partial<InsertTemplateLogo>): Promise<TemplateLogo | undefined> {
    try {
      const [updatedLogo] = await db.update(templateLogos)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(templateLogos.id, id))
        .returning();
      return updatedLogo;
    } catch (error) {
      console.error("Error updating template logo:", error);
      return undefined;
    }
  }

  async deleteTemplateLogo(id: number): Promise<boolean> {
    try {
      const result = await db.delete(templateLogos).where(eq(templateLogos.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting template logo:", error);
      return false;
    }
  }

  // ============================
  // شعارات المستخدم - User Logos
  // ============================

  async getUserLogos(userId: number): Promise<UserLogo[]> {
    try {
      const logosList = await db.select().from(userLogos)
        .where(eq(userLogos.userId, userId))
        .orderBy(desc(userLogos.updatedAt));
      return logosList;
    } catch (error) {
      console.error("Error fetching user logos:", error);
      return [];
    }
  }

  async getUserLogo(id: number): Promise<UserLogo | undefined> {
    try {
      const [logo] = await db.select().from(userLogos).where(eq(userLogos.id, id));
      return logo;
    } catch (error) {
      console.error("Error fetching user logo:", error);
      return undefined;
    }
  }

  async createUserLogo(logo: InsertUserLogo): Promise<UserLogo> {
    try {
      const [newLogo] = await db.insert(userLogos).values(logo).returning();
      return newLogo;
    } catch (error) {
      console.error("Error creating user logo:", error);
      throw error;
    }
  }

  async updateUserLogo(id: number, data: Partial<InsertUserLogo>): Promise<UserLogo | undefined> {
    try {
      const [updatedLogo] = await db.update(userLogos)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(userLogos.id, id))
        .returning();
      return updatedLogo;
    } catch (error) {
      console.error("Error updating user logo:", error);
      return undefined;
    }
  }

  async deleteUserLogo(id: number): Promise<boolean> {
    try {
      const result = await db.delete(userLogos).where(eq(userLogos.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting user logo:", error);
      return false;
    }
  }

  // ====================================
  // توقيعات المستخدم - User Signatures
  // ====================================

  async getUserSignatures(userId: number, type?: string): Promise<UserSignature[]> {
    try {
      let query = db.select().from(userSignatures)
        .where(eq(userSignatures.userId, userId));
      
      if (type) {
        query = query.where(eq(userSignatures.type, type));
      }
      
      const signaturesList = await query.orderBy(desc(userSignatures.updatedAt));
      return signaturesList;
    } catch (error) {
      console.error("Error fetching user signatures:", error);
      return [];
    }
  }

  async getUserSignature(id: number): Promise<UserSignature | undefined> {
    try {
      const [signature] = await db.select().from(userSignatures)
        .where(eq(userSignatures.id, id));
      return signature;
    } catch (error) {
      console.error("Error fetching user signature:", error);
      return undefined;
    }
  }

  async createUserSignature(signature: InsertUserSignature): Promise<UserSignature> {
    try {
      const [newSignature] = await db.insert(userSignatures).values(signature).returning();
      return newSignature;
    } catch (error) {
      console.error("Error creating user signature:", error);
      throw error;
    }
  }

  async updateUserSignature(id: number, data: Partial<InsertUserSignature>): Promise<UserSignature | undefined> {
    try {
      const [updatedSignature] = await db.update(userSignatures)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(userSignatures.id, id))
        .returning();
      return updatedSignature;
    } catch (error) {
      console.error("Error updating user signature:", error);
      return undefined;
    }
  }

  async deleteUserSignature(id: number): Promise<boolean> {
    try {
      const result = await db.delete(userSignatures).where(eq(userSignatures.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting user signature:", error);
      return false;
    }
  }
  
  // إعدادات النظام - System Settings
  // هذه الدالة موجودة ومنفذة في مكان آخر
  // This function is now implemented elsewhere
  
  // Legacy function - uses the replacement implemented above
  async getSettings(category: string): Promise<any> {
    try {
      const settingsArray = await this.getSettingsByCategory(category);
      
      // Transform the array to an object
      const settingsObject: Record<string, any> = {};
      for (const setting of settingsArray) {
        let value = setting.value;
        // Try to parse if it's a string that looks like JSON
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Not JSON, keep as is
          }
        }
        settingsObject[setting.key] = value;
      }
      
      return settingsObject;
    } catch (error) {
      console.error(`Error retrieving settings for category ${category}:`, error);
      return {};
    }
  }
  
  async updateSettings(category: string, data: any): Promise<boolean> {
    try {
      // تحديث أو إضافة كل إعداد
      for (const [key, value] of Object.entries(data)) {
        await this.updateSettingValue(category, key, value);
      }
      return true;
    } catch (error) {
      console.error(`Error updating settings for category ${category}:`, error);
      return false;
    }
  }
  
  async getSettingValue(category: string, key: string): Promise<any> {
    try {
      const query = `SELECT value FROM settings WHERE category = '${category}' AND key = '${key}'`;
      const result = await db.execute(query);
      
      if (result.rows.length === 0) return null;
      const value = result.rows[0].value;
      
      // محاولة تحليل القيمة كـ JSON إذا كانت مخزنة كنص
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch (e) {
          // إذا فشل التحليل، أعد القيمة كما هي
          return value;
        }
      }
      
      return value;
    } catch (error) {
      console.error(`Error retrieving setting ${category}.${key}:`, error);
      return null;
    }
  }
  
  async updateSettingValue(category: string, key: string, value: any): Promise<boolean> {
    try {
      // تحويل القيمة إلى JSON إذا كانت كائن أو مصفوفة
      const valueToStore = typeof value === 'object' ? JSON.stringify(value) : String(value);
      
      // البحث عن الإعداد الحالي
      const checkQuery = `SELECT key FROM settings WHERE category = '${category}' AND key = '${key}'`;
      const checkResult = await db.execute(checkQuery);
      
      if (checkResult.rows.length > 0) {
        // تحديث إذا كان موجودًا
        const updateQuery = `UPDATE settings SET value = '${valueToStore}', updated_at = NOW() WHERE category = '${category}' AND key = '${key}'`;
        await db.execute(updateQuery);
      } else {
        // إضافة إذا لم يكن موجودًا
        const insertQuery = `INSERT INTO settings (category, key, value, updated_at) VALUES ('${category}', '${key}', '${valueToStore}', NOW())`;
        await db.execute(insertQuery);
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating setting ${category}.${key}:`, error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
