'use client';
import React, { useState, useEffect } from 'react';
import { InventoryStatus, PublicInventoryStatus } from '@/lib/inventory';

type StockIndicatorInventory = Pick<
  InventoryStatus,
  'stockStatus' | 'availableStock' | 'allowBackorders'
> | PublicInventoryStatus;

interface StockIndicatorProps {
  productId: string;
  showDetails?: boolean;
  className?: string;
  /** Shown when no inventory row exists (typical for one-of-a-kind originals). */
  missingInventoryLabel?: string;
  /**
   * When provided by a parent that already loaded inventory (e.g. Inventory dashboard),
   * use that live data instead of a one-shot mount fetch that goes stale after saves.
   */
  inventory?: StockIndicatorInventory | null;
}

export function StockIndicator({
  productId,
  showDetails = false,
  className = "",
  missingInventoryLabel,
  inventory: inventoryFromParent,
}: StockIndicatorProps) {
  const controlled = inventoryFromParent !== undefined;
  const [fetchedInventory, setFetchedInventory] = useState<StockIndicatorInventory | null>(null);
  const [isLoading, setIsLoading] = useState(!controlled);
  const inventory = controlled ? inventoryFromParent : fetchedInventory;

  useEffect(() => {
    if (controlled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchInventory = async () => {
      try {
        const response = await fetch(`/api/inventory?productId=${productId}`);
        const data = await response.json();
        
        if (!cancelled && data.success) {
          setFetchedInventory(data.inventory);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchInventory();
    return () => {
      cancelled = true;
    };
  }, [productId, controlled, inventoryFromParent]);

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>
    );
  }

  if (!inventory) {
    if (!missingInventoryLabel) {
      return null;
    }
    return (
      <div className={className}>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border text-green-600 bg-green-50 border-green-200">
          {missingInventoryLabel}
        </span>
      </div>
    );
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
          color: 'text-amber-800 bg-amber-50 border-amber-200',
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