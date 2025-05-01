import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Template } from '@shared/schema';
import { storage } from '../storage';

/**
 * Interface for social media format dimensions
 */
export interface SocialFormat {
  width: number;
  height: number;
  ratio: string;
  description: string;
}

/**
 * Default social media formats in case settings are not available
 */
export const DEFAULT_SOCIAL_FORMATS: Record<string, SocialFormat> = {
  instagram: { width: 1080, height: 1080, ratio: '1:1', description: 'Instagram (Square)' },
  instagramStory: { width: 1080, height: 1920, ratio: '9:16', description: 'Instagram Story' },
  facebook: { width: 1200, height: 630, ratio: '1.91:1', description: 'Facebook' },
  twitter: { width: 1200, height: 675, ratio: '16:9', description: 'Twitter' },
  whatsapp: { width: 800, height: 800, ratio: '1:1', description: 'WhatsApp' },
  pinterest: { width: 1000, height: 1500, ratio: '2:3', description: 'Pinterest' }
};

/**
 * Get available social media formats from settings
 */
export async function getSocialFormats(): Promise<Record<string, SocialFormat>> {
  try {
    const settings = await storage.getSettingsByCategory('social-formats');
    
    // Initialize with default formats
    const formats = { ...DEFAULT_SOCIAL_FORMATS };
    
    // Override with settings from database if available
    for (const setting of settings) {
      try {
        if (typeof setting.value === 'string') {
          const parsedValue = JSON.parse(setting.value);
          formats[setting.key] = parsedValue;
        }
      } catch (e) {
        console.error(`Error parsing social format setting ${setting.key}:`, e);
      }
    }
    
    return formats;
  } catch (error) {
    console.error('Error loading social formats:', error);
    return DEFAULT_SOCIAL_FORMATS;
  }
}

/**
 * Generate a card image in a specific social media format
 * 
 * @param templateImagePath Path to the original card image
 * @param format Social media format to generate
 * @param options Additional options
 * @returns Path to the generated image
 */
export async function generateSocialImage(
  templateImagePath: string,
  format: string | SocialFormat,
  options: {
    quality?: 'low' | 'medium' | 'high' | 'preview' | 'download',
    watermark?: boolean,
    watermarkText?: string,
    cropMode?: 'fit' | 'fill' | 'cover'
  } = {}
): Promise<string> {
  try {
    // Set quality and format based on options
    let outputQuality: number;
    let imageFormat: string = "image/png";
    
    // Set quality based on options
    switch(options.quality) {
      case 'preview':
        outputQuality = 0.6; // Lower quality for preview (<1MB)
        imageFormat = "image/jpeg";
        break;
      case 'download':
        outputQuality = 0.9; // Higher quality for download (up to 2MB)
        break;
      case 'low':
        outputQuality = 0.4;
        imageFormat = "image/jpeg";
        break;
      case 'medium':
        outputQuality = 0.7;
        break;
      case 'high':
        outputQuality = 0.9;
        break;
      default:
        outputQuality = 0.8; // Default quality
    }
    
    // Determine the format to use
    let formatSpec: SocialFormat;
    
    if (typeof format === 'string') {
      // Get formats from settings or use defaults
      const formats = await getSocialFormats();
      formatSpec = formats[format] || DEFAULT_SOCIAL_FORMATS.instagram;
    } else {
      formatSpec = format;
    }
    
    // Create canvas with format dimensions
    const canvas = createCanvas(formatSpec.width, formatSpec.height);
    const ctx = canvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, formatSpec.width, formatSpec.height);
    
    // Load the original image
    const originalImagePath = templateImagePath.startsWith('/') 
      ? path.join(process.cwd(), templateImagePath.substring(1)) 
      : templateImagePath;
      
    const image = await loadImage(originalImagePath);
    
    // Calculate dimensions for the image based on crop mode
    const cropMode = options.cropMode || 'fit';
    let sx = 0, sy = 0, sWidth = image.width, sHeight = image.height; 
    let dx = 0, dy = 0, dWidth = formatSpec.width, dHeight = formatSpec.height;
    
    const originalRatio = image.width / image.height;
    const targetRatio = formatSpec.width / formatSpec.height;
    
    if (cropMode === 'fit') {
      // Fit entire image within the target dimensions (may have empty space)
      if (originalRatio > targetRatio) {
        // Original is wider, constrain width
        dWidth = formatSpec.width;
        dHeight = dWidth / originalRatio;
        dy = (formatSpec.height - dHeight) / 2;
      } else {
        // Original is taller, constrain height
        dHeight = formatSpec.height;
        dWidth = dHeight * originalRatio;
        dx = (formatSpec.width - dWidth) / 2;
      }
    } else if (cropMode === 'fill' || cropMode === 'cover') {
      // Fill the entire target dimensions (may crop the image)
      if (originalRatio > targetRatio) {
        // Original is wider, crop width
        sWidth = image.height * targetRatio;
        sx = (image.width - sWidth) / 2;
      } else {
        // Original is taller, crop height
        sHeight = image.width / targetRatio;
        sy = (image.height - sHeight) / 2;
      }
    }
    
    // Draw the image
    ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
    
    // Add watermark if requested
    if (options.watermark) {
      const text = options.watermarkText || 'Certificate Card';
      ctx.globalAlpha = 0.25;
      ctx.font = `14px Arial`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'end';
      ctx.fillText(text, formatSpec.width - 20, formatSpec.height - 20);
      ctx.globalAlpha = 1.0;
    }
    
    // Generate unique filename with appropriate extension
    const extension = imageFormat === "image/jpeg" ? "jpg" : "png";
    const qualitySuffix = options.quality || "medium";
    const formatName = typeof format === 'string' ? format : 'custom';
    const filename = `social_${crypto.randomBytes(8).toString("hex")}_${formatName}_${qualitySuffix}.${extension}`;
    const outputPath = path.join(process.cwd(), "uploads", filename);
    
    // Generate buffer based on format
    const buffer = imageFormat === "image/jpeg" 
      ? canvas.toBuffer("image/jpeg", { quality: outputQuality }) 
      : canvas.toBuffer("image/png");
    
    fs.writeFileSync(outputPath, buffer);
    
    return `/uploads/${filename}`;
  } catch (error) {
    console.error("Error generating social image:", error);
    throw new Error("فشل في إنشاء صورة لوسائل التواصل الاجتماعي");
  }
}