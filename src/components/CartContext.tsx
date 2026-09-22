'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
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

const CART_STORAGE_KEY = 'artist-site-cart';
const CART_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function persistCartState(state: CartState): void {
  if (typeof window === 'undefined' || !state.isLoaded) {
    return;
  }

  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ ...state, isOpen: false }),
    );
  } catch (error) {
    console.error('Failed to save cart to localStorage:', error);
  }
}

function shouldPersistCartAction(action: CartAction): boolean {
  return (
    action.type === 'ADD_ITEM' ||
    action.type === 'REMOVE_ITEM' ||
    action.type === 'UPDATE_QUANTITY' ||
    action.type === 'UPDATE_ITEM_VARIANT' ||
    action.type === 'CLEAR_CART' ||
    action.type === 'LOAD_CART'
  );
}

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
        isLoaded: true,
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
  restoreCart: (items: CartItem[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, baseDispatch] = useReducer(cartReducer, initialState);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const dispatch = useCallback((action: CartAction) => {
    const nextState = cartReducer(stateRef.current, action);
    if (shouldPersistCartAction(action)) {
      persistCartState(nextState);
    }
    baseDispatch(action);
  }, []);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          if (Date.now() - parsedCart.lastUpdated < CART_MAX_AGE_MS) {
            dispatch({ type: 'LOAD_CART', payload: parsedCart });
            return;
          }
        } catch (error) {
          console.error('Failed to load cart from localStorage:', error);
        }
      }
      dispatch({ type: 'CART_LOADED' });
    }
  }, [dispatch]);

  const addItem = useCallback((
    product: Product,
    quantity?: number,
    variant?: CartItemVariant,
    customizations?: Record<string, string>,
  ) => {
    dispatch({
      type: 'ADD_ITEM',
      payload: { product, quantity, variant, customizations },
    });
  }, [dispatch]);

  const removeItem = useCallback((productId: string, variantKey?: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { productId, variantKey } });
  }, [dispatch]);

  const updateQuantity = useCallback((productId: string, quantity: number, variantKey?: string) => {
    dispatch({
      type: 'UPDATE_QUANTITY',
      payload: { productId, quantity, variantKey },
    });
  }, [dispatch]);

  const updateItemVariant = useCallback((
    productId: string,
    variant: CartItemVariant,
    customizations?: Record<string, string>,
    variantKey?: string,
  ) => {
    dispatch({
      type: 'UPDATE_ITEM_VARIANT',
      payload: { productId, variant, customizations, variantKey },
    });
  }, [dispatch]);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, [dispatch]);

  const toggleCart = useCallback(() => {
    dispatch({ type: 'TOGGLE_CART' });
  }, [dispatch]);

  const openCart = useCallback(() => {
    dispatch({ type: 'OPEN_CART' });
  }, [dispatch]);

  const closeCart = useCallback(() => {
    dispatch({ type: 'CLOSE_CART' });
  }, [dispatch]);

  const getItemKey = useCallback((productId: string, variant?: CartItemVariant) => {
    return generateVariantKey(productId, variant);
  }, []);

  const restoreCart = useCallback((items: CartItem[]) => {
    const { total, itemCount } = calculateCartTotals(items);
    dispatch({
      type: 'LOAD_CART',
      payload: {
        items,
        total,
        itemCount,
        isOpen: false,
        lastUpdated: Date.now(),
        isLoaded: true,
      },
    });
  }, [dispatch]);

  const contextValue = useMemo<CartContextType>(() => ({
    state,
    addItem,
    removeItem,
    updateQuantity,
    updateItemVariant,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
    getItemKey,
    restoreCart,
  }), [
    state,
    addItem,
    removeItem,
    updateQuantity,
    updateItemVariant,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
    getItemKey,
    restoreCart,
  ]);

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