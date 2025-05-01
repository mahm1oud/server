import express, { Request, Response } from 'express';
import { isAdmin } from '../auth';
import { storage } from '../storage';

const router = express.Router();

// Get display settings
router.get('/display', isAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await storage.getSettings('display');
    res.json({ settings: settings || {
      displayMode: 'multi',
      templateViewMode: 'multi-page', // 'multi-page' للطريقة التقليدية، 'single-page' للطريقة الجديدة
      enableSocialFormats: true,
      defaultSocialFormat: 'instagram'
    }});
  } catch (error) {
    console.error('Error fetching display settings:', error);
    res.status(500).json({ message: 'Error fetching display settings' });
  }
});

// Update display settings
router.post('/display', isAdmin, async (req: Request, res: Response) => {
  try {
    const { displayMode, templateViewMode, enableSocialFormats, defaultSocialFormat } = req.body;
    
    const settings = {
      displayMode: displayMode || 'multi',
      templateViewMode: templateViewMode || 'multi-page', // إضافة خيار عرض القوالب (متعدد الصفحات أو صفحة واحدة)
      enableSocialFormats: enableSocialFormats !== undefined ? enableSocialFormats : true,
      defaultSocialFormat: defaultSocialFormat || null
    };
    
    await storage.updateSettings('display', settings);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating display settings:', error);
    res.status(500).json({ message: 'Error updating display settings' });
  }
});

// Get social media formats
router.get('/social-formats', async (req: Request, res: Response) => {
  try {
    // Import the social image generator module
    const { DEFAULT_SOCIAL_FORMATS } = await import('../lib/social-image-generator');
    
    // Use the DEFAULT_SOCIAL_FORMATS from the module as a fallback
    let formats = DEFAULT_SOCIAL_FORMATS;
    
    try {
      // Try to get formats from database
      const settingsArray = await storage.getSettingsByCategory('social-formats');
      
      // If formats exist in the database, use them
      if (settingsArray && settingsArray.length > 0) {
        formats = {};
        
        for (const setting of settingsArray) {
          try {
            if (setting.key && setting.value) {
              formats[setting.key] = JSON.parse(String(setting.value));
            }
          } catch (parseError) {
            console.error(`Error parsing format setting for ${setting.key}:`, parseError);
          }
        }
      }
    } catch (dbError) {
      console.error('Error fetching social formats from database:', dbError);
    }
    
    res.json({ formats });
  } catch (error) {
    console.error('Error fetching social formats:', error);
    res.status(500).json({ message: 'Error fetching social formats' });
  }
});

// Update social media formats
router.post('/social-formats', isAdmin, async (req: Request, res: Response) => {
  try {
    const { formats } = req.body;
    
    if (!formats || typeof formats !== 'object') {
      return res.status(400).json({ message: 'Invalid format data' });
    }
    
    // Update each format in the database
    const results = [];
    
    for (const [key, value] of Object.entries(formats)) {
      const stringValue = JSON.stringify(value);
      const result = await storage.updateSetting('social-formats', key, stringValue);
      results.push(result);
    }
    
    res.json({ success: true, results });
  } catch (error) {
    console.error('Error updating social formats:', error);
    res.status(500).json({ message: 'Error updating social formats' });
  }
});

export default router;