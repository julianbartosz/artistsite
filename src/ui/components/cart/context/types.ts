// filepath: src/ui/components/cart/context/types.ts
'use client';
import type { Product, CartItemVariant } from '@domain/shop';

export interface CartItem {
  product: Product;
  quantity: number;
  variant?: CartItemVariant;
  customizations?: Record<string, string>;
  totalPrice: number; // Calculated price including variants
  addedAt: number; // Timestamp for ordering/expiry
}

export interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  isOpen: boolean;
  lastUpdated: number;
}

export type CartAction =
  | {
      type: 'ADD_ITEM';
      payload: {
        product: Product;
        quantity?: number;
        variant?: CartItemVariant;
        customizations?: Record<string, string>;
      };
    }
  | { type: 'REMOVE_ITEM'; payload: { productId: string; variantKey?: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number; variantKey?: string } }
  | {
      type: 'UPDATE_ITEM_VARIANT';
      payload: {
        productId: string;
        variant: CartItemVariant;
        customizations?: Record<string, string>;
        variantKey?: string;
      };
    }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'LOAD_CART'; payload: CartState };

export interface CartContextApi {
  state: CartState;
  addItem: (
    product: Product,
    quantity?: number,
    variant?: CartItemVariant,
    customizations?: Record<string, string>
  ) => void;
  removeItem: (productId: string, variantKey?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantKey?: string) => void;
  updateItemVariant: (
    productId: string,
    variant: CartItemVariant,
    customizations?: Record<string, string>,
    variantKey?: string
  ) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  getItemKey: (productId: string, variant?: CartItemVariant) => string;
}
