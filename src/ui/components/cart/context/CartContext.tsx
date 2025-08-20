'use client';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import type { CartContextApi } from './types';
import { CartState, CartItem } from './types';
import { cartReducer, initialState } from './reducer';
import { generateVariantKey } from './utils';

const CartContext = createContext<CartContextApi | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedCart = localStorage.getItem('artist-site-cart');
    if (!savedCart) return;
    try {
      const parsed = JSON.parse(savedCart) as CartState;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      if (Date.now() - parsed.lastUpdated < maxAge) {
        dispatch({ type: 'LOAD_CART', payload: parsed });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load cart from localStorage:', err);
    }
  }, []);

  // Persist cart
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('artist-site-cart', JSON.stringify(state));
  }, [state]);

  const value: CartContextApi = {
    state,
    addItem: (product, quantity, variant, customizations) =>
      dispatch({ type: 'ADD_ITEM', payload: { product, quantity, variant, customizations } }),
    removeItem: (productId, variantKey) =>
      dispatch({ type: 'REMOVE_ITEM', payload: { productId, variantKey } }),
    updateQuantity: (productId, quantity, variantKey) =>
      dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity, variantKey } }),
    updateItemVariant: (productId, variant, customizations, variantKey) =>
      dispatch({ type: 'UPDATE_ITEM_VARIANT', payload: { productId, variant, customizations, variantKey } }),
    clearCart: () => dispatch({ type: 'CLEAR_CART' }),
    toggleCart: () => dispatch({ type: 'TOGGLE_CART' }),
    openCart: () => dispatch({ type: 'OPEN_CART' }),
    closeCart: () => dispatch({ type: 'CLOSE_CART' }),
    getItemKey: generateVariantKey,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

export type { CartItem, CartState } from './types';
