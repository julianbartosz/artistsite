// Promo Code Management System
import { db } from '@/lib/db';

export interface PromoCode {
  id: string;
  code: string;
  campaignId?: string | null;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: Date | null;
  createdAt: Date;
  conditions?: PromoCodeConditions;
}

export interface PromoCodeConditions {
  minimum_order_value?: number;
  maximum_discount?: number;
  applicable_categories?: string[];
  applicable_products?: string[];
  first_time_customers_only?: boolean;
  user_segments?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  discount_amount?: number;
  final_total?: number;
}

export interface CampaignAnalysis {
  total_codes_generated: number;
  codes_used: number;
  usage_rate: number;
  total_discount_given: number;
  revenue_generated: number;
  average_order_value: number;
  roi: number;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  category?: string;
}

interface DbPromoCode {
  id: string;
  code: string;
  campaignId: string | null;
  discountType: string;
  discountValue: number;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: Date | null;
  createdAt: Date;
}

interface AnalyticsEventData {
  properties: string;
  eventName: string;
  userId?: string | null;
}

export class PromoCodeManager {
  // Generate promo code for campaigns
  static async generateCode(
    campaign: string, 
    discount: number, 
    discountType: 'percentage' | 'fixed' = 'percentage',
    _conditions?: PromoCodeConditions
  ): Promise<PromoCode> {
    try {
      const code = this.generateUniqueCode(campaign);
      
      const dbPromoCode = await db.promoCode.create({
        data: {
          code,
          discountType,
          discountValue: discount,
          usageLimit: 1,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date()
        }
      });

      // Track promo code creation
      await db.analyticsEvent.create({
        data: {
          eventName: 'promo_code_created',
          properties: JSON.stringify({
            code,
            discount_type: discountType,
            discount_value: discount,
            usage_limit: 1,
            creation_source: 'automated_marketing'
          }),
          timestamp: new Date()
        }
      });

      // Transform database result to match interface
      return this.transformDbPromoCode(dbPromoCode);
    } catch (error) {
      throw new Error(`Failed to generate promo code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Validate promo code
  static async validateCode(
    code: string, 
    _userId?: string, 
    cartTotal?: number,
    cartItems?: CartItem[]
  ): Promise<ValidationResult> {
    try {
      const promoCode = await db.promoCode.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (!promoCode) {
        return { isValid: false, error: 'Invalid promo code' };
      }

      // Check expiration
      if (promoCode.expiresAt && promoCode.expiresAt < new Date()) {
        return { isValid: false, error: 'Promo code has expired' };
      }

      // Check usage limit
      if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
        return { isValid: false, error: 'Promo code usage limit reached' };
      }

      // Calculate discount
      const discountAmount = this.calculateDiscount(
        promoCode, 
        cartTotal || 0, 
        cartItems
      );

      const finalTotal = Math.max(0, (cartTotal || 0) - discountAmount);

      return {
        isValid: true,
        discount_amount: discountAmount,
        final_total: finalTotal
      };
    } catch (error) {
      return { 
        isValid: false, 
        error: `Error validating promo code: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Apply promo code to order
  static async applyCode(code: string, userId: string, orderId: string): Promise<void> {
    try {
      const promoCode = await db.promoCode.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (!promoCode) return;

      // Increment usage count
      await db.promoCode.update({
        where: { id: promoCode.id },
        data: { usageCount: promoCode.usageCount + 1 }
      });

      // Track usage
      await db.analyticsEvent.create({
        data: {
          eventName: 'promo_code_used',
          userId: userId,
          properties: JSON.stringify({
            code,
            order_id: orderId,
            discount_amount: 0, // Calculate based on order
            campaign_id: promoCode.campaignId
          }),
          timestamp: new Date()
        }
      });
    } catch (error) {
      throw new Error(`Failed to apply promo code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Track promo code usage analytics
  static async trackUsage(
    code: string, 
    userId: string, 
    discountAmount: number, 
    orderTotal: number
  ): Promise<void> {
    try {
      await db.analyticsEvent.create({
        data: {
          eventName: 'promo_code_used',
          userId: userId,
          properties: JSON.stringify({
            code,
            discount_amount: discountAmount,
            order_total: orderTotal,
            savings_percentage: (discountAmount / orderTotal) * 100
          }),
          timestamp: new Date()
        }
      });
    } catch (error) {
      throw new Error(`Failed to track promo code usage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Analyze campaign performance
  static async analyzeCampaignPerformance(campaign: string): Promise<CampaignAnalysis> {
    try {
      const promoCodes = await db.promoCode.findMany({
        where: { campaignId: campaign }
      });

      const usageEvents = await db.analyticsEvent.findMany({
        where: {
          eventName: 'promo_code_used',
          properties: { contains: `"campaign_id":"${campaign}"` }
        }
      });

      const totalCodesGenerated = promoCodes.length;
      const codesUsed = promoCodes.filter((code: DbPromoCode) => code.usageCount > 0).length;
      const usageRate = totalCodesGenerated > 0 ? (codesUsed / totalCodesGenerated) * 100 : 0;

      const totalDiscountGiven = usageEvents.reduce((sum: number, event: AnalyticsEventData) => {
        const properties = typeof event.properties === 'string' ? JSON.parse(event.properties) : event.properties;
        return sum + (properties.discount_amount || 0);
      }, 0);

      const revenueGenerated = usageEvents.reduce((sum: number, event: AnalyticsEventData) => {
        const properties = typeof event.properties === 'string' ? JSON.parse(event.properties) : event.properties;
        return sum + (properties.order_total || 0);
      }, 0);

      const averageOrderValue = usageEvents.length > 0 ? 
        revenueGenerated / usageEvents.length : 0;

      const roi = totalDiscountGiven > 0 ? 
        ((revenueGenerated - totalDiscountGiven) / totalDiscountGiven) * 100 : 0;

      return {
        total_codes_generated: totalCodesGenerated,
        codes_used: codesUsed,
        usage_rate: usageRate,
        total_discount_given: totalDiscountGiven,
        revenue_generated: revenueGenerated,
        average_order_value: averageOrderValue,
        roi: roi
      };
    } catch (error) {
      throw new Error(`Failed to analyze campaign performance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper methods
  private static generateUniqueCode(campaign: string): string {
    const prefix = campaign.toUpperCase().substring(0, 4);
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${suffix}`;
  }

  private static calculateDiscount(
    promoCode: DbPromoCode, 
    cartTotal: number, 
    _cartItems?: CartItem[]
  ): number {
    // Simple discount calculation using schema fields
    let discount = 0;

    if (promoCode.discountType === 'percentage') {
      discount = (cartTotal * promoCode.discountValue) / 100;
    } else {
      discount = promoCode.discountValue;
    }

    return Math.min(discount, cartTotal); // Can't discount more than the total
  }

  private static transformDbPromoCode(dbPromoCode: DbPromoCode): PromoCode {
    return {
      id: dbPromoCode.id,
      code: dbPromoCode.code,
      campaignId: dbPromoCode.campaignId,
      discountType: dbPromoCode.discountType as 'percentage' | 'fixed',
      discountValue: dbPromoCode.discountValue,
      usageLimit: dbPromoCode.usageLimit,
      usageCount: dbPromoCode.usageCount,
      expiresAt: dbPromoCode.expiresAt,
      createdAt: dbPromoCode.createdAt
    };
  }

  // Bulk operations
  static async generateBulkCodes(
    campaign: string,
    count: number,
    discount: number,
    discountType: 'percentage' | 'fixed' = 'percentage',
    _conditions?: PromoCodeConditions
  ): Promise<PromoCode[]> {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      const code = await this.generateCode(campaign, discount, discountType);
      codes.push(code);
    }

    // Track bulk generation
    await db.analyticsEvent.create({
      data: {
        eventName: 'bulk_promo_codes_generated',
        properties: JSON.stringify({
          campaign,
          count,
          discount_type: discountType,
          discount_value: discount
        }),
        timestamp: new Date()
      }
    });

    return codes;
  }

  // Get active codes for campaign
  static async getActiveCodes(campaign: string): Promise<PromoCode[]> {
    const dbCodes = await db.promoCode.findMany({
      where: {
        campaignId: campaign,
        expiresAt: { gt: new Date() },
        OR: [
          { usageLimit: null },
          { usageCount: { lt: db.promoCode.fields.usageLimit } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return dbCodes.map(this.transformDbPromoCode);
  }

  // Deactivate codes
  static async deactivateCodes(campaign: string): Promise<void> {
    await db.promoCode.updateMany({
      where: { campaignId: campaign },
      data: { expiresAt: new Date() }
    });

    await db.analyticsEvent.create({
      data: {
        eventName: 'promo_codes_deactivated',
        properties: JSON.stringify({ campaign }),
        timestamp: new Date()
      }
    });
  }
}