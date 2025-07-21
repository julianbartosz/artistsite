// Promo Code Management System
import { db } from '@/lib/db';

export interface PromoCode {
  id: string;
  code: string;
  campaign_id?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  usage_limit: number;
  usage_count: number;
  expires_at: Date;
  created_at: Date;
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

export class PromoCodeManager {
  // Generate promo code for campaigns
  static async generateCode(
    campaign: string, 
    discount: number, 
    type: 'percentage' | 'fixed' = 'percentage',
    conditions?: PromoCodeConditions
  ): Promise<PromoCode> {
    try {
      const code = this.generateUniqueCode(campaign);
      
      const promoCode = await db.promoCodes.create({
        data: {
          code,
          campaign_id: campaign,
          discount_type: type,
          discount_value: discount,
          usage_limit: conditions?.first_time_customers_only ? 1 : 100,
          usage_count: 0,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          created_at: new Date(),
          conditions: conditions || {}
        }
      });

      // Track code generation
      await db.analyticsEvents.create({
        data: {
          event_name: 'promo_code_generated',
          properties: {
            code,
            campaign,
            discount_type: type,
            discount_value: discount,
            usage_limit: promoCode.usage_limit
          },
          timestamp: new Date()
        }
      });

      return promoCode;
    } catch (error) {
      console.error('Error generating promo code:', error);
      throw error;
    }
  }

  // Validate promo code
  static async validateCode(
    code: string, 
    userId?: string, 
    cartTotal?: number,
    cartItems?: any[]
  ): Promise<ValidationResult> {
    try {
      const promoCode = await db.promoCodes.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (!promoCode) {
        return { isValid: false, error: 'Invalid promo code' };
      }

      // Check expiration
      if (promoCode.expires_at < new Date()) {
        return { isValid: false, error: 'Promo code has expired' };
      }

      // Check usage limit
      if (promoCode.usage_count >= promoCode.usage_limit) {
        return { isValid: false, error: 'Promo code usage limit reached' };
      }

      // Check conditions
      const conditionsCheck = await this.checkConditions(
        promoCode, 
        userId, 
        cartTotal, 
        cartItems
      );

      if (!conditionsCheck.isValid) {
        return conditionsCheck;
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
      console.error('Error validating promo code:', error);
      return { isValid: false, error: 'Error validating promo code' };
    }
  }

  // Apply promo code to order
  static async applyCode(code: string, userId: string, orderId: string): Promise<void> {
    try {
      const promoCode = await db.promoCodes.findUnique({
        where: { code: code.toUpperCase() }
      });

      if (!promoCode) return;

      // Increment usage count
      await db.promoCodes.update({
        where: { id: promoCode.id },
        data: { usage_count: promoCode.usage_count + 1 }
      });

      // Track usage
      await db.analyticsEvents.create({
        data: {
          event_name: 'promo_code_used',
          user_id: userId,
          properties: {
            code,
            order_id: orderId,
            discount_amount: 0, // Calculate based on order
            campaign_id: promoCode.campaign_id
          },
          timestamp: new Date()
        }
      });

      console.log(`Promo code ${code} applied to order ${orderId}`);
    } catch (error) {
      console.error('Error applying promo code:', error);
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
      await db.analyticsEvents.create({
        data: {
          event_name: 'promo_code_used',
          user_id: userId,
          properties: {
            code,
            discount_amount: discountAmount,
            order_total: orderTotal,
            savings_percentage: (discountAmount / orderTotal) * 100
          },
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error tracking promo code usage:', error);
    }
  }

  // Analyze campaign performance
  static async analyzeCampaignPerformance(campaign: string): Promise<CampaignAnalysis> {
    try {
      const promoCodes = await db.promoCodes.findMany({
        where: { campaign_id: campaign }
      });

      const usageEvents = await db.analyticsEvents.findMany({
        where: {
          event_name: 'promo_code_used',
          properties: { path: ['campaign_id'], equals: campaign }
        }
      });

      const totalCodesGenerated = promoCodes.length;
      const codesUsed = promoCodes.filter(code => code.usage_count > 0).length;
      const usageRate = totalCodesGenerated > 0 ? (codesUsed / totalCodesGenerated) * 100 : 0;

      const totalDiscountGiven = usageEvents.reduce((sum, event) => 
        sum + (event.properties.discount_amount || 0), 0
      );

      const revenueGenerated = usageEvents.reduce((sum, event) => 
        sum + (event.properties.order_total || 0), 0
      );

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
      console.error('Error analyzing campaign performance:', error);
      throw error;
    }
  }

  // Helper methods
  private static generateUniqueCode(campaign: string): string {
    const prefix = campaign.toUpperCase().substring(0, 4);
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${suffix}`;
  }

  private static async checkConditions(
    promoCode: PromoCode, 
    userId?: string, 
    cartTotal?: number,
    cartItems?: any[]
  ): Promise<ValidationResult> {
    const conditions = promoCode.conditions as PromoCodeConditions;
    
    if (!conditions) return { isValid: true };

    // Check minimum order value
    if (conditions.minimum_order_value && cartTotal && cartTotal < conditions.minimum_order_value) {
      return { 
        isValid: false, 
        error: `Minimum order value of $${conditions.minimum_order_value} required` 
      };
    }

    // Check first-time customer restriction
    if (conditions.first_time_customers_only && userId) {
      const orderCount = await db.order.count({
        where: { user_id: userId, status: 'completed' }
      });
      
      if (orderCount > 0) {
        return { 
          isValid: false, 
          error: 'This code is only valid for first-time customers' 
        };
      }
    }

    // Check applicable categories
    if (conditions.applicable_categories && cartItems) {
      const hasApplicableItems = cartItems.some(item => 
        conditions.applicable_categories?.includes(item.product.category)
      );
      
      if (!hasApplicableItems) {
        return { 
          isValid: false, 
          error: 'No applicable items in cart for this promo code' 
        };
      }
    }

    // Check user segments
    if (conditions.user_segments && userId) {
      const userProfile = await db.customerProfiles.findUnique({
        where: { id: userId }
      });
      
      const userSegments = userProfile?.segments || [];
      const hasValidSegment = conditions.user_segments.some(segment => 
        userSegments.includes(segment)
      );
      
      if (!hasValidSegment) {
        return { 
          isValid: false, 
          error: 'You are not eligible for this promo code' 
        };
      }
    }

    return { isValid: true };
  }

  private static calculateDiscount(
    promoCode: PromoCode, 
    cartTotal: number, 
    cartItems?: any[]
  ): number {
    const conditions = promoCode.conditions as PromoCodeConditions;
    let applicableTotal = cartTotal;

    // If restricted to certain categories/products, calculate applicable total
    if (conditions?.applicable_categories && cartItems) {
      applicableTotal = cartItems
        .filter(item => conditions.applicable_categories?.includes(item.product.category))
        .reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    }

    if (conditions?.applicable_products && cartItems) {
      applicableTotal = cartItems
        .filter(item => conditions.applicable_products?.includes(item.product.id))
        .reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    }

    let discount = 0;

    if (promoCode.discount_type === 'percentage') {
      discount = (applicableTotal * promoCode.discount_value) / 100;
    } else {
      discount = promoCode.discount_value;
    }

    // Apply maximum discount limit
    if (conditions?.maximum_discount) {
      discount = Math.min(discount, conditions.maximum_discount);
    }

    return Math.min(discount, applicableTotal); // Can't discount more than the applicable total
  }

  // Bulk operations
  static async generateBulkCodes(
    campaign: string,
    count: number,
    discount: number,
    type: 'percentage' | 'fixed' = 'percentage',
    conditions?: PromoCodeConditions
  ): Promise<PromoCode[]> {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      const code = await this.generateCode(campaign, discount, type, conditions);
      codes.push(code);
    }

    // Track bulk generation
    await db.analyticsEvents.create({
      data: {
        event_name: 'bulk_promo_codes_generated',
        properties: {
          campaign,
          count,
          discount_type: type,
          discount_value: discount
        },
        timestamp: new Date()
      }
    });

    return codes;
  }

  // Get active codes for campaign
  static async getActiveCodes(campaign: string): Promise<PromoCode[]> {
    return await db.promoCodes.findMany({
      where: {
        campaign_id: campaign,
        expires_at: { gt: new Date() },
        usage_count: { lt: db.promoCodes.fields.usage_limit }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  // Deactivate codes
  static async deactivateCodes(campaign: string): Promise<void> {
    await db.promoCodes.updateMany({
      where: { campaign_id: campaign },
      data: { expires_at: new Date() }
    });

    await db.analyticsEvents.create({
      data: {
        event_name: 'promo_codes_deactivated',
        properties: { campaign },
        timestamp: new Date()
      }
    });
  }
}