import express, { Request, Response } from 'express';
import { isAdmin } from '../auth';
import { storage } from '../storage';
import { z } from 'zod';
import { db } from '../db';
import { authSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Get all auth settings
router.get('/', isAdmin, async (req: Request, res: Response) => {
  try {
    const settings = await storage.getAllAuthSettings();
    res.json({ settings });
  } catch (error) {
    console.error('Error fetching auth settings:', error);
    res.status(500).json({ message: 'Failed to fetch auth settings' });
  }
});

// Get settings for a specific provider
router.get('/:provider', isAdmin, async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    const settings = await storage.getAuthSettings(provider);
    
    if (!settings) {
      return res.status(404).json({ message: `Settings for provider ${provider} not found` });
    }
    
    res.json({ settings });
  } catch (error) {
    console.error(`Error fetching auth settings for provider ${req.params.provider}:`, error);
    res.status(500).json({ message: 'Failed to fetch provider settings' });
  }
});

// Create or update auth settings
router.post('/', isAdmin, async (req: Request, res: Response) => {
  try {
    const settingsSchema = z.object({
      provider: z.string(),
      clientId: z.string().optional(),
      clientSecret: z.string().optional(),
      redirectUri: z.string().optional(),
      enabled: z.boolean(),
      settings: z.record(z.any()).optional()
    });
    
    const validationResult = settingsSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Invalid settings data', 
        errors: validationResult.error.errors 
      });
    }
    
    const settingsData = validationResult.data;
    
    // Check if settings for this provider already exist
    const existingSettings = await storage.getAuthSettings(settingsData.provider);
    
    let result;
    if (existingSettings) {
      // Update existing settings
      result = await storage.updateAuthSettings(
        settingsData.provider, 
        {
          clientId: settingsData.clientId,
          clientSecret: settingsData.clientSecret,
          redirectUri: settingsData.redirectUri,
          enabled: settingsData.enabled,
          settings: settingsData.settings
        }
      );
    } else {
      // Insert new settings directly using Drizzle
      const [newSettings] = await db.insert(authSettings)
        .values({
          provider: settingsData.provider,
          clientId: settingsData.clientId,
          clientSecret: settingsData.clientSecret,
          redirectUri: settingsData.redirectUri,
          enabled: settingsData.enabled,
          settings: settingsData.settings || {},
          updatedAt: new Date(),
          updatedBy: req.user?.id
        })
        .returning();
      
      result = {
        id: newSettings.id,
        provider: newSettings.provider,
        clientId: newSettings.clientId,
        clientSecret: newSettings.clientSecret,
        redirectUri: newSettings.redirectUri,
        enabled: newSettings.enabled,
        settings: newSettings.settings,
        updatedAt: newSettings.updatedAt,
        updatedBy: newSettings.updatedBy
      };
    }
    
    res.json({ 
      message: `Settings for ${settingsData.provider} ${existingSettings ? 'updated' : 'created'} successfully`,
      settings: result
    });
    
  } catch (error) {
    console.error('Error saving auth settings:', error);
    res.status(500).json({ message: 'Failed to save auth settings' });
  }
});

// Delete auth settings for a provider
router.delete('/:provider', isAdmin, async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider;
    
    // Delete settings using Drizzle
    const result = await db.delete(authSettings)
      .where(eq(authSettings.provider, provider))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ message: `Settings for provider ${provider} not found` });
    }
    
    res.json({ 
      message: `Settings for ${provider} deleted successfully`,
      settings: result[0]
    });
    
  } catch (error) {
    console.error(`Error deleting auth settings for provider ${req.params.provider}:`, error);
    res.status(500).json({ message: 'Failed to delete provider settings' });
  }
});

export default router;