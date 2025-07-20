'use client';
import React, { useState, useEffect } from 'react';
import { InventoryStatus } from '@/lib/inventory';

interface StockIndicatorProps {
  productId: string;
  showDetails?: boolean;
  className?: string;
}

export function StockIndicator({ productId, showDetails = false, className = "" }: StockIndicatorProps) {
  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const response = await fetch(`/api/inventory?productId=${productId}`);
        const data = await response.json();
        
        if (data.success) {
          setInventory(data.inventory);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, [productId]);

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>
    );
  }

  if (!inventory) {
    return null;
  }

  const getStatusConfig = () => {
    switch (inventory.stockStatus) {
      case 'in_stock':
        return {
          color: 'text-green-600 bg-green-50 border-green-200',
          label: 'In Stock',
          icon: '●'
        };
      case 'low_stock':
        return {
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          label: 'Low Stock',
          icon: '◐'
        };
      case 'out_of_stock':
        return {
          color: 'text-red-600 bg-red-50 border-red-200',
          label: 'Out of Stock',
          icon: '○'
        };
      case 'discontinued':
        return {
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          label: 'Discontinued',
          icon: '⊗'
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          label: 'Unknown',
          icon: '?'
        };
    }
  };

  const config = getStatusConfig();

  if (showDetails) {
    return (
      <div className={`${className}`}>
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${config.color}`}>
          <span className="mr-2">{config.icon}</span>
          {config.label}
          {inventory.stockStatus === 'low_stock' && (
            <span className="ml-2 text-xs">
              ({inventory.availableStock} left)
            </span>
          )}
        </div>
        {inventory.allowBackorders && inventory.stockStatus === 'out_of_stock' && (
          <div className="mt-1 text-xs text-blue-600">
            Backorders accepted
          </div>
        )}
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color} ${className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
}

export default StockIndicator;