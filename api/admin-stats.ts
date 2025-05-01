import express, { Request, Response } from 'express';
import { isAdmin } from '../auth';
import { storage } from '../storage';
import { db } from '../db';
import { users, certificates, cards, categories, templates } from '@shared/schema';
import { count, sql } from 'drizzle-orm';
import { and, gt, lt } from 'drizzle-orm/expressions';
import { sub } from 'date-fns';

const router = express.Router();

// Get admin dashboard stats
router.get('/stats', isAdmin, async (req: Request, res: Response) => {
  try {
    // Get total counts
    const [
      usersCount, 
      categoriesCount, 
      templatesCount, 
      certificatesCount, 
      cardsCount
    ] = await Promise.all([
      db.select({ count: count() }).from(users).then(result => result[0]?.count || 0),
      db.select({ count: count() }).from(categories).then(result => result[0]?.count || 0),
      db.select({ count: count() }).from(templates).then(result => result[0]?.count || 0),
      db.select({ count: count() }).from(certificates).then(result => result[0]?.count || 0),
      db.select({ count: count() }).from(cards).then(result => result[0]?.count || 0)
    ]);
    
    // Calculate dates for this week and last week
    const now = new Date();
    const oneWeekAgo = sub(now, { weeks: 1 });
    const twoWeeksAgo = sub(now, { weeks: 2 });
    
    // Get counts for this week
    const [
      newUsersThisWeek,
      newCardsThisWeek,
      newCertificatesThisWeek
    ] = await Promise.all([
      db.select({ count: count() })
        .from(users)
        .where(gt(users.createdAt, oneWeekAgo))
        .then(result => result[0]?.count || 0),
      
      db.select({ count: count() })
        .from(cards)
        .where(gt(cards.createdAt, oneWeekAgo))
        .then(result => result[0]?.count || 0),
      
      db.select({ count: count() })
        .from(certificates)
        .where(gt(certificates.createdAt, oneWeekAgo))
        .then(result => result[0]?.count || 0)
    ]);
    
    // Get counts for last week
    const [
      newUsersLastWeek,
      newCardsLastWeek,
      newCertificatesLastWeek
    ] = await Promise.all([
      db.select({ count: count() })
        .from(users)
        .where(and(
          gt(users.createdAt, twoWeeksAgo),
          lt(users.createdAt, oneWeekAgo)
        ))
        .then(result => result[0]?.count || 0),
      
      db.select({ count: count() })
        .from(cards)
        .where(and(
          gt(cards.createdAt, twoWeeksAgo),
          lt(cards.createdAt, oneWeekAgo)
        ))
        .then(result => result[0]?.count || 0),
      
      db.select({ count: count() })
        .from(certificates)
        .where(and(
          gt(certificates.createdAt, twoWeeksAgo),
          lt(certificates.createdAt, oneWeekAgo)
        ))
        .then(result => result[0]?.count || 0)
    ]);
    
    // Calculate growth percentages
    const calculateGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };
    
    const userGrowth = calculateGrowth(newUsersThisWeek, newUsersLastWeek);
    const cardGrowth = calculateGrowth(newCardsThisWeek, newCardsLastWeek);
    const certificateGrowth = calculateGrowth(newCertificatesThisWeek, newCertificatesLastWeek);
    
    res.json({
      totalUsers: usersCount,
      totalCategories: categoriesCount,
      totalTemplates: templatesCount,
      totalCertificates: certificatesCount,
      totalCards: cardsCount,
      newUsersThisWeek,
      newCardsThisWeek,
      newCertificatesThisWeek,
      userGrowth,
      cardGrowth,
      certificateGrowth
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Error fetching admin statistics' });
  }
});

// Get recent certificates
router.get('/certificates/recent', isAdmin, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    
    const recentCertificates = await db.select({
      id: certificates.id,
      title: certificates.title,
      createdAt: certificates.createdAt,
      status: certificates.status,
      userId: certificates.userId,
      imageUrl: certificates.imageUrl
    })
    .from(certificates)
    .orderBy(sql`${certificates.createdAt} DESC`)
    .limit(limit);
    
    // Enhance with user information if available
    const result = await Promise.all(recentCertificates.map(async (cert) => {
      let user = null;
      if (cert.userId) {
        const [userResult] = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(sql`${users.id} = ${cert.userId}`);
        user = userResult;
      }
      
      return {
        ...cert,
        user: user || undefined
      };
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching recent certificates:', error);
    res.status(500).json({ message: 'Error fetching recent certificates' });
  }
});

// Get recent cards
router.get('/cards/recent', isAdmin, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    
    const recentCards = await db.select({
      id: cards.id,
      formData: cards.formData,
      createdAt: cards.createdAt,
      status: cards.status,
      userId: cards.userId,
      imageUrl: cards.imageUrl
    })
    .from(cards)
    .orderBy(sql`${cards.createdAt} DESC`)
    .limit(limit);
    
    // Enhance with user information if available
    const result = await Promise.all(recentCards.map(async (card) => {
      let user = null;
      if (card.userId) {
        const [userResult] = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(sql`${users.id} = ${card.userId}`);
        user = userResult;
      }
      
      // إنشاء عنوان من بيانات النموذج إن وجدت
      const formData = card.formData as Record<string, any> || {};
      const title = formData.title || formData.name || formData.eventName || 'بطاقة بدون عنوان';
      
      return {
        ...card,
        title,
        user: user || undefined
      };
    }));
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching recent cards:', error);
    res.status(500).json({ message: 'Error fetching recent cards' });
  }
});

// Get recent users
router.get('/users/recent', isAdmin, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
    
    const recentUsers = await db.select({
      id: users.id,
      title: sql`COALESCE(${users.username}, ${users.email}, 'مستخدم')`,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(sql`${users.createdAt} DESC`)
    .limit(limit);
    
    res.json(recentUsers);
  } catch (error) {
    console.error('Error fetching recent users:', error);
    res.status(500).json({ message: 'Error fetching recent users' });
  }
});

export default router;