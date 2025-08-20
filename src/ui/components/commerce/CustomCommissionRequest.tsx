'use client';
import { useState } from 'react';
import { Product, formatPrice } from '@domain/shop';
import CommissionTypeSelector from './CustomCommissionRequest/CommissionTypeSelector';
import BudgetRange from './CustomCommissionRequest/BudgetRange';

interface CommissionRequestFormData {
  type: 'similar' | 'custom' | 'consultation';
  medium: string;
  dimensions: string;
  description: string;
  inspirationImages?: FileList;
  budget: { min: number; max: number };
  timeline: string;
  customerInfo: { name: string; email: string; phone?: string; preferredContact: 'email' | 'phone' };
  specialRequests?: string;
}

interface CustomCommissionRequestProps {
  product?: Product;
  onSubmit: (formData: CommissionRequestFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function CustomCommissionRequest({ product, onSubmit, onCancel, isLoading = false }: CustomCommissionRequestProps) {
  const [formData, setFormData] = useState<CommissionRequestFormData>({
    type: product ? 'similar' : 'custom',
    medium: product?.medium || '',
    dimensions: product?.dimensions || '',
    description: '',
    budget: { min: product?.commissionInfo?.priceRange.min || 500, max: product?.commissionInfo?.priceRange.max || 2000 },
    timeline: '',
    customerInfo: { name: '', email: '', preferredContact: 'email' }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.customerInfo.name.trim()) newErrors.name = 'Name is required';
    if (!formData.customerInfo.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.customerInfo.email)) newErrors.email = 'Please enter a valid email address';
    if (formData.customerInfo.preferredContact === 'phone' && !formData.customerInfo.phone?.trim()) newErrors.phone = 'Phone number is required when selected as preferred contact';
    if (!formData.description.trim()) newErrors.description = 'Please describe what you\'re looking for';
    if (!formData.timeline) newErrors.timeline = 'Please select a timeline';
    if (formData.budget.min >= formData.budget.max) newErrors.budget = 'Maximum budget must be higher than minimum budget';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) onSubmit(formData);
  };

  const handleInputChange = (field: keyof CommissionRequestFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleCustomerInfoChange = (field: keyof CommissionRequestFormData['customerInfo'], value: string) => {
    setFormData(prev => ({ ...prev, customerInfo: { ...prev.customerInfo, [field]: value } }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleBudgetChange = (field: 'min' | 'max', value: number) => {
    setFormData(prev => ({ ...prev, budget: { ...prev.budget, [field]: value } }));
    if (errors.budget) setErrors(prev => ({ ...prev, budget: '' }));
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {product ? `Commission Similar to "${product.title}"` : 'Custom Commission Request'}
        </h2>
        <p className="text-gray-600">
          {product ? 'Request a custom piece inspired by or similar to this artwork.' : 'Share your vision and we\'ll work together to create something unique.'}
        </p>
        {product?.commissionInfo && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800"><strong>Estimated Timeline:</strong> {product.commissionInfo.estimatedDays} days</p>
            <p className="text-sm text-blue-800"><strong>Price Range:</strong> {formatPrice(product.commissionInfo.priceRange.min)} - {formatPrice(product.commissionInfo.priceRange.max)}</p>
            {product.commissionInfo.requiresConsultation && (
              <p className="text-sm text-blue-800 mt-2">ℹ️ This commission type requires an initial consultation</p>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {!product && (
          <CommissionTypeSelector value={formData.type} onChange={(v) => handleInputChange('type', v)} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Medium</label>
            <select value={formData.medium} onChange={(e) => handleInputChange('medium', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">Select medium...</option>
              <option value="Oil on canvas">Oil on Canvas</option>
              <option value="Acrylic on canvas">Acrylic on Canvas</option>
              <option value="Watercolor on paper">Watercolor on Paper</option>
              <option value="Charcoal on paper">Charcoal on Paper</option>
              <option value="Mixed media">Mixed Media</option>
              <option value="Digital art">Digital Art</option>
              <option value="Other">Other (specify in description)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Dimensions</label>
            <select value={formData.dimensions} onChange={(e) => handleInputChange('dimensions', e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">Select size...</option>
              <option value='8" x 10"'>8&quot; x 10&quot; (Small)</option>
              <option value='11" x 14"'>11&quot; x 14&quot; (Medium)</option>
              <option value='16" x 20"'>16&quot; x 20&quot; (Large)</option>
              <option value='18" x 24"'>18&quot; x 24&quot; (Large)</option>
              <option value='24" x 36"'>24&quot; x 36&quot; (Extra Large)</option>
              <option value='30" x 40"'>30&quot; x 40&quot; (Extra Large)</option>
              <option value="Custom">Custom Size (specify in description)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Project Description *</label>
          <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Describe your vision, style preferences, color palette, subject matter, or any specific requirements..." className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${errors.description ? 'border-red-300' : 'border-gray-300'}`} rows={5} required />
          {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
        </div>

        <BudgetRange min={formData.budget.min} max={formData.budget.max} onChange={handleBudgetChange} error={errors.budget} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Timeline *</label>
          <select value={formData.timeline} onChange={(e) => handleInputChange('timeline', e.target.value)} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${errors.timeline ? 'border-red-300' : 'border-gray-300'}`} required>
            <option value="">Select timeline...</option>
            <option value="2-4 weeks">2-4 weeks</option>
            <option value="1-2 months">1-2 months</option>
            <option value="2-3 months">2-3 months</option>
            <option value="3-6 months">3-6 months</option>
            <option value="6+ months">6+ months</option>
            <option value="Flexible">Flexible</option>
          </select>
          {errors.timeline && <p className="text-red-500 text-sm mt-1">{errors.timeline}</p>}
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <input type="text" value={formData.customerInfo.name} onChange={(e) => handleCustomerInfoChange('name', e.target.value)} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${errors.name ? 'border-red-300' : 'border-gray-300'}`} required />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
              <input type="email" value={formData.customerInfo.email} onChange={(e) => handleCustomerInfoChange('email', e.target.value)} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${errors.email ? 'border-red-300' : 'border-gray-300'}`} required />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input type="tel" value={formData.customerInfo.phone || ''} onChange={(e) => handleCustomerInfoChange('phone', e.target.value)} className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${errors.phone ? 'border-red-300' : 'border-gray-300'}`} placeholder="Optional" />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
          </div>
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Preferred Contact Method</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input type="radio" name="preferredContact" value="email" checked={formData.customerInfo.preferredContact === 'email'} onChange={(e) => handleCustomerInfoChange('preferredContact', e.target.value as 'email' | 'phone')} className="text-indigo-600 focus:ring-indigo-500" />
                <span className="ml-2 text-sm text-gray-700">Email</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="preferredContact" value="phone" checked={formData.customerInfo.preferredContact === 'phone'} onChange={(e) => handleCustomerInfoChange('preferredContact', e.target.value as 'email' | 'phone')} className="text-indigo-600 focus:ring-indigo-500" />
                <span className="ml-2 text-sm text-gray-700">Phone</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes or Special Requests</label>
          <textarea value={formData.specialRequests || ''} onChange={(e) => handleInputChange('specialRequests', e.target.value)} placeholder="Any additional information, special requirements, or questions..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" rows={3} />
        </div>

        <div className="flex gap-4 pt-6 border-t">
          <button type="button" onClick={onCancel} className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors" disabled={isLoading}>Cancel</button>
          <button type="submit" disabled={isLoading} className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? 'Submitting...' : 'Submit Commission Request'}</button>
        </div>
      </form>
    </div>
  );
}
