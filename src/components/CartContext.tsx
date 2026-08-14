'use client'

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Product, CartItemVariant, calculateVariantPrice } from '@/lib/commerce';

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
  isLoaded: boolean;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: { 
      product: Product; 
      quantity?: number; 
      variant?: CartItemVariant;
      customizations?: Record<string, string>;
    } }
  | { type: 'REMOVE_ITEM'; payload: { productId: string; variantKey?: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number; variantKey?: string } }
  | { type: 'UPDATE_ITEM_VARIANT'; payload: { 
      productId: string; 
      variant: CartItemVariant;
      customizations?: Record<string, string>;
      variantKey?: string;
    } }
  | { type: 'CLEAR_CART' }
  | { type: 'TOGGLE_CART' }
  | { type: 'OPEN_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'LOAD_CART'; payload: CartState }
  | { type: 'CART_LOADED' };

const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
  isOpen: false,
  lastUpdated: Date.now(),
  isLoaded: false,
};

// Generate unique key for cart items with variants
function generateVariantKey(productId: string, variant?: CartItemVariant): string {
  if (!variant) return productId;
  
  const parts = [productId];
  if (variant.size) parts.push(`size:${variant.size.id}`);
  if (variant.framing) parts.push(`frame:${variant.framing.id}`);
  if (variant.material) parts.push(`material:${variant.material.id}`);
  
  return parts.join('|');
}

function calculateCartTotals(items: CartItem[]): { total: number; itemCount: number } {
  const total = items.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { total, itemCount };
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity = 1, variant, customizations } = action.payload;
      const variantKey = generateVariantKey(product.id, variant);
      const totalPrice = calculateVariantPrice(product.price, variant);
      
      const existingItemIndex = state.items.findIndex(
        item => generateVariantKey(item.product.id, item.variant) === variantKey
      );

      let newItems: CartItem[];
      
      if (existingItemIndex > -1) {
        // Update existing item quantity
        newItems = state.items.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item
        const newItem: CartItem = {
          product,
          quantity,
          variant,
          customizations,
          totalPrice,
          addedAt: Date.now()
        };
        newItems = [...state.items, newItem];
      }

      const { total, itemCount } = calculateCartTotals(newItems);
      
      return {
        ...state,
        items: newItems,
        total,
        itemCount,
        lastUpdated: Date.now(),
      };
    }

    case 'REMOVE_ITEM': {
      const { productId, variantKey } = action.payload;
      const keyToMatch = variantKey || productId;
      
      const newItems = state.items.filter(item => 
        generateVariantKey(item.product.id, item.variant) !== keyToMatch
      );
      const { total, itemCount } = calculateCartTotals(newItems);
      
      return {
        ...state,
        items: newItems,
        total,
        itemCount,
        lastUpdated: Date.now(),
      };
    }

    case 'UPDATE_QUANTITY': {
      const { productId, quantity, variantKey } = action.payload;
      const keyToMatch = variantKey || productId;
      
      if (quantity <= 0) {
        return cartReducer(state, { 
          type: 'REMOVE_ITEM', 
          payload: { productId, variantKey } 
        });
      }

      const newItems = state.items.map(item => {
        const itemKey = generateVariantKey(item.product.id, item.variant);
        return itemKey === keyToMatch
          ? { ...item, quantity }
          : item;
      });
      
      const { total, itemCount } = calculateCartTotals(newItems);
      
      return {
        ...state,
        items: newItems,
        total,
        itemCount,
        lastUpdated: Date.now(),
      };
    }

    case 'UPDATE_ITEM_VARIANT': {
      const { productId, variant, customizations, variantKey } = action.payload;
      const keyToMatch = variantKey || productId;
      
      const newItems = state.items.map(item => {
        const itemKey = generateVariantKey(item.product.id, item.variant);
        if (itemKey === keyToMatch) {
          const newTotalPrice = calculateVariantPrice(item.product.price, variant);
          return {
            ...item,
            variant,
            customizations,
            totalPrice: newTotalPrice
          };
        }
        return item;
      });
      
      const { total, itemCount } = calculateCartTotals(newItems);
      
      return {
        ...state,
        items: newItems,
        total,
        itemCount,
        lastUpdated: Date.now(),
      };
    }

    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
        total: 0,
        itemCount: 0,
        lastUpdated: Date.now(),
      };

    case 'TOGGLE_CART':
      return {
        ...state,
        isOpen: !state.isOpen,
      };

    case 'OPEN_CART':
      return {
        ...state,
        isOpen: true,
      };

    case 'CLOSE_CART':
      return {
        ...state,
        isOpen: false,
      };

    case 'LOAD_CART':
      return { ...action.payload, isOpen: false, isLoaded: true };

    case 'CART_LOADED':
      return { ...state, isLoaded: true };

    default:
      return state;
  }
}

interface CartContextType {
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

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem('artist-site-cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          // Validate cart age (expire after 7 days)
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
          if (Date.now() - parsedCart.lastUpdated < maxAge) {
            dispatch({ type: 'LOAD_CART', payload: parsedCart });
            return;
          }
        } catch (error) {
          console.error('Failed to load cart from localStorage:', error);
        }
      }
      dispatch({ type: 'CART_LOADED' });
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && state.isLoaded) {
      localStorage.setItem('artist-site-cart', JSON.stringify(state));
    }
  }, [state]);

  const contextValue: CartContextType = {
    state,
    addItem: (product, quantity, variant, customizations) => {
      dispatch({ 
        type: 'ADD_ITEM', 
        payload: { product, quantity, variant, customizations } 
      });
    },
    removeItem: (productId, variantKey) => {
      dispatch({ type: 'REMOVE_ITEM', payload: { productId, variantKey } });
    },
    updateQuantity: (productId, quantity, variantKey) => {
      dispatch({ 
        type: 'UPDATE_QUANTITY', 
        payload: { productId, quantity, variantKey } 
      });
    },
    updateItemVariant: (productId, variant, customizations, variantKey) => {
      dispatch({
        type: 'UPDATE_ITEM_VARIANT',
        payload: { productId, variant, customizations, variantKey }
      });
    },
    clearCart: () => {
      dispatch({ type: 'CLEAR_CART' });
    },
    toggleCart: () => {
      dispatch({ type: 'TOGGLE_CART' });
    },
    openCart: () => {
      dispatch({ type: 'OPEN_CART' });
    },
    closeCart: () => {
      dispatch({ type: 'CLOSE_CART' });
    },
    getItemKey: generateVariantKey,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}