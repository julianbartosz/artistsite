import { Order, OrderStatus } from './orders';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class OrderEmailService {
  /**
   * Generate order confirmation email
   */
  static generateConfirmationEmail(order: Order): EmailTemplate {
    const customerName = `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`;
    
    const subject = `Order Confirmation - ${order.orderNumber}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
    .content { background: #f9fafb; padding: 20px; }
    .order-summary { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
    .item { border-bottom: 1px solid #e5e7eb; padding: 10px 0; }
    .total { font-weight: bold; font-size: 18px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Order Confirmed!</h1>
      <p>Thank you for your purchase, ${customerName}</p>
    </div>
    
    <div class="content">
      <h2>Order Details</h2>
      <div class="order-summary">
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Order Date:</strong> ${order.createdAt.toLocaleDateString()}</p>
        <p><strong>Status:</strong> ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
        
        <h3>Items Ordered:</h3>
        ${order.items.map(item => `
          <div class="item">
            <h4>${item.product.title}</h4>
            ${item.selectedVariant ? `<p>Variant: ${item.selectedVariant.name}</p>` : ''}
            ${item.customizations?.length ? `<p>Customizations: ${item.customizations.map(c => c.name).join(', ')}</p>` : ''}
            <p>Quantity: ${item.quantity} × $${item.unitPrice.toFixed(2)} = $${item.totalPrice.toFixed(2)}</p>
          </div>
        `).join('')}
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
          <p>Subtotal: $${order.subtotal.toFixed(2)}</p>
          <p>Shipping: $${order.shipping.toFixed(2)}</p>
          <p>Tax: $${order.tax.toFixed(2)}</p>
          <p class="total">Total: $${order.total.toFixed(2)}</p>
        </div>
      </div>
      
      <h3>Shipping Address:</h3>
      <div class="order-summary">
        <p>${order.shippingAddress.firstName} ${order.shippingAddress.lastName}</p>
        ${order.shippingAddress.company ? `<p>${order.shippingAddress.company}</p>` : ''}
        <p>${order.shippingAddress.address1}</p>
        ${order.shippingAddress.address2 ? `<p>${order.shippingAddress.address2}</p>` : ''}
        <p>${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}</p>
        <p>${order.shippingAddress.country}</p>
      </div>
      
      ${order.specialInstructions ? `
        <h3>Special Instructions:</h3>
        <div class="order-summary">
          <p>${order.specialInstructions}</p>
        </div>
      ` : ''}
      
      ${order.type === 'commission' ? `
        <div style="background: #dbeafe; border: 1px solid #93c5fd; padding: 15px; margin: 20px 0; border-radius: 8px;">
          <h3>🎨 Commission Order</h3>
          <p>This is a custom commission order. I will contact you within 24-48 hours to discuss details, timeline, and next steps for your custom artwork.</p>
        </div>
      ` : ''}
      
      <p>We'll send you updates as your order progresses. You can track your order anytime using your order number.</p>
    </div>
    
    <div class="footer">
      <p>Thank you for supporting independent art!</p>
      <p>Questions? Reply to this email or contact us.</p>
    </div>
  </div>
</body>
</html>`;

    const text = `
Order Confirmation - ${order.orderNumber}

Thank you for your purchase, ${customerName}!

Order Details:
- Order Number: ${order.orderNumber}
- Order Date: ${order.createdAt.toLocaleDateString()}
- Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}

Items Ordered:
${order.items.map(item => `
- ${item.product.title}
  ${item.selectedVariant ? `Variant: ${item.selectedVariant.name}` : ''}
  Quantity: ${item.quantity} × $${item.unitPrice.toFixed(2)} = $${item.totalPrice.toFixed(2)}
`).join('')}

Order Total: $${order.total.toFixed(2)}

Shipping Address:
${order.shippingAddress.firstName} ${order.shippingAddress.lastName}
${order.shippingAddress.address1}
${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}

${order.type === 'commission' ? 'This is a custom commission order. I will contact you within 24-48 hours to discuss details.' : ''}

Thank you for supporting independent art!
`;

    return { subject, html, text };
  }

  /**
   * Generate shipping notification email
   */
  static generateShippingEmail(order: Order): EmailTemplate {
    const customerName = `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`;
    
    const subject = `Your order ${order.orderNumber} has shipped! 📦`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
    .content { background: #f9fafb; padding: 20px; }
    .tracking { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
    .tracking-number { font-size: 24px; font-weight: bold; color: #7c3aed; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Your Order Has Shipped!</h1>
      <p>Order ${order.orderNumber} is on its way, ${customerName}</p>
    </div>
    
    <div class="content">
      ${order.trackingNumber ? `
        <div class="tracking">
          <h2>Track Your Package</h2>
          <p>Tracking Number:</p>
          <div class="tracking-number">${order.trackingNumber}</div>
          <p style="margin-top: 20px;">
            <a href="#" style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Track Package
            </a>
          </p>
        </div>
      ` : ''}
      
      <p>Your artwork has been carefully packaged and is now on its way to you!</p>
      
      ${order.estimatedDelivery ? `
        <p><strong>Estimated Delivery:</strong> ${new Date(order.estimatedDelivery).toLocaleDateString()}</p>
      ` : ''}
      
      <p>We'll notify you when your package is delivered. Thank you for your patience!</p>
    </div>
  </div>
</body>
</html>`;

    const text = `
Your order ${order.orderNumber} has shipped!

${order.trackingNumber ? `Tracking Number: ${order.trackingNumber}` : ''}
${order.estimatedDelivery ? `Estimated Delivery: ${new Date(order.estimatedDelivery).toLocaleDateString()}` : ''}

Your artwork has been carefully packaged and is on its way to you!
`;

    return { subject, html, text };
  }

  /**
   * Generate delivery confirmation email
   */
  static generateDeliveryEmail(order: Order): EmailTemplate {
    const customerName = `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`;
    
    const subject = `Your order ${order.orderNumber} has been delivered! 🎉`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #059669; color: white; padding: 20px; text-align: center; }
    .content { background: #f9fafb; padding: 20px; }
    .cta { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Your Order Has Been Delivered!</h1>
      <p>Order ${order.orderNumber} is now with you, ${customerName}</p>
    </div>
    
    <div class="content">
      <p>Your artwork has been successfully delivered! We hope you love your new piece.</p>
      
      <div class="cta">
        <h3>Share Your Experience</h3>
        <p>We'd love to see your artwork in its new home! Share a photo and tag us on social media.</p>
        <p>
          <a href="#" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px;">
            Leave a Review
          </a>
          <a href="/shop" style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px;">
            Shop More Art
          </a>
        </p>
      </div>
      
      <p>Thank you for supporting independent art. Your purchase helps me continue creating!</p>
    </div>
  </div>
</body>
</html>`;

    const text = `
Your order ${order.orderNumber} has been delivered!

Your artwork has been successfully delivered! We hope you love your new piece.

Thank you for supporting independent art.
`;

    return { subject, html, text };
  }

  /**
   * Get appropriate email template based on order status
   */
  static getEmailForStatus(order: Order, status: OrderStatus): EmailTemplate | null {
    switch (status) {
      case 'confirmed':
        return this.generateConfirmationEmail(order);
      case 'shipped':
        return this.generateShippingEmail(order);
      case 'delivered':
        return this.generateDeliveryEmail(order);
      default:
        return null;
    }
  }

  /**
   * Send email notification (mock implementation)
   * In production, integrate with email service like SendGrid, Mailgun, etc.
   */
  static async sendEmail(
    to: string,
    template: EmailTemplate,
    order: Order
  ): Promise<boolean> {
    try {
      // Mock email sending - replace with actual email service
      console.log(`📧 Sending email to ${to}`);
      console.log(`Subject: ${template.subject}`);
      console.log(`Order: ${order.orderNumber}`);
      
      // In production, use email service:
      // await emailService.send({
      //   to,
      //   subject: template.subject,
      //   html: template.html,
      //   text: template.text
      // });
      
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  /**
   * Send order status update notification
   */
  static async sendStatusUpdate(order: Order, newStatus: OrderStatus): Promise<boolean> {
    const template = this.getEmailForStatus(order, newStatus);
    if (!template) {
      return false;
    }

    return await this.sendEmail(order.customerEmail, template, order);
  }
}