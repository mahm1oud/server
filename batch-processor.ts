import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { storage } from './storage';
import { Template } from '@shared/schema';
import { generateCertificateImage } from './certificate-generator';
import { format } from 'date-fns';
import { randomUUID } from 'crypto';

/**
 * Process an Excel or CSV file to generate certificates in batch
 * 
 * @param batchId The ID of the batch in the database
 * @param filePath Path to the Excel/CSV file
 * @param template Template to use for certificates
 */
export async function processExcelBatch(batchId: number, filePath: string, template: Template): Promise<void> {
  try {
    // Update batch status to processing
    await storage.updateCertificateBatch(batchId, {
      status: 'processing',
      processedItems: 0
    });
    
    // Read the file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    // Update total items count
    await storage.updateCertificateBatch(batchId, {
      totalItems: data.length
    });
    
    // Get batch details
    const batch = await storage.getCertificateBatch(batchId);
    if (!batch) {
      throw new Error("Batch not found");
    }
    
    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 because row 1 is headers
      
      try {
        // Create batch item entry
        const batchItem = await storage.createBatchItem({
          batchId,
          status: 'processing',
          formData: row,
          rowNumber
        });
        
        // Map the Excel data to certificate fields
        // The assumption is that column names match field names
        const formData: Record<string, any> = {
          ...row,
          date: row.date ? formatExcelDate(row.date) : format(new Date(), 'yyyy/MM/dd')
        };
        
        // Generate certificate image
        const imagePath = await generateCertificateImage(template, formData);
        
        // Create certificate
        const certificate = await storage.createCertificate({
          templateId: template.id,
          userId: batch.userId,
          title: formData.title || template.title,
          titleAr: formData.titleAr || template.titleAr,
          certificateType: formData.certificateType || 'appreciation',
          formData,
          imageUrl: `/uploads/${path.basename(imagePath)}`,
          status: 'active',
          issuedTo: formData.issuedTo || formData.name || formData.recipient,
          issuedToGender: formData.issuedToGender || formData.gender || 'male',
          publicId: randomUUID(),
          verificationCode: generateVerificationCode()
        });
        
        // Update batch item
        await storage.updateBatchItem(batchItem.id, {
          certificateId: certificate.id,
          status: 'completed',
          processedAt: new Date()
        });
        
        // Update batch processed count
        await storage.updateCertificateBatch(batchId, {
          processedItems: i + 1
        });
      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        
        // Update batch item with error
        await storage.updateBatchItem(i + 1, {
          status: 'failed',
          errorMessage: `${error}`,
          processedAt: new Date()
        });
      }
    }
    
    // Update batch status to completed
    await storage.updateCertificateBatch(batchId, {
      status: 'completed',
      completedAt: new Date()
    });
    
    // Clean up the temp file
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.warn("Could not delete temp file:", filePath, error);
    }
  } catch (error) {
    console.error("Error processing batch:", error);
    
    // Update batch status to failed
    await storage.updateCertificateBatch(batchId, {
      status: 'failed'
    });
    
    throw error;
  }
}

/**
 * Format Excel date number to a readable date string
 * @param excelDate Excel date (number of days since Jan 1, 1900)
 * @returns Formatted date string
 */
function formatExcelDate(excelDate: number | string): string {
  try {
    // If it's already a string, return it
    if (typeof excelDate === 'string') {
      return excelDate;
    }
    
    // Convert Excel date number to JavaScript Date
    // Excel dates are number of days since Jan 1, 1900
    // But Excel incorrectly assumes 1900 is a leap year
    // So we need to adjust if the date is after Feb 28, 1900
    let date = new Date((excelDate - 25569) * 86400 * 1000);
    
    // Format date as YYYY/MM/DD
    return format(date, 'yyyy/MM/dd');
  } catch (error) {
    console.error("Error formatting Excel date:", error);
    return String(excelDate); // Return as is if there's an error
  }
}

/**
 * Generate a verification code for certificates
 * @returns Verification code
 */
// Generate a verification code for certificates
export function generateVerificationCode(): string {
  // Generate a random 6-character alphanumeric code
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}