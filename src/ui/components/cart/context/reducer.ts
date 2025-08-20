// filepath: src/ui/components/cart/context/reducer.ts
'use client';
import { calculateVariantPrice } from '@domain/shop';
import type { CartState, CartItem, CartAction } from './types';
import { calculateCartTotals, generateVariantKey } from './utils';

export const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
  isOpen: false,
  lastUpdated: Date.now(),
};

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity = 1, variant, customizations } = action.payload;
      const variantKey = generateVariantKey(product.id, variant);
      const totalPrice = calculateVariantPrice(product.price, variant);

      const existingItemIndex = state.items.findIndex(
        (item) => generateVariantKey(item.product.id, item.variant) === variantKey
      );

      let newItems: CartItem[];
      if (existingItemIndex > -1) {
        newItems = state.items.map((item, index) =>
          index === existingItemIndex ? { ...item, quantity: item.quantity + quantity } : item
        );
      } else {
        const newItem: CartItem = {
          product,
          quantity,
          variant,
          customizations,
          totalPrice,
          addedAt: Date.now(),
        };
        newItems = [...state.items, newItem];
      }

      const { total, itemCount } = calculateCartTotals(newItems);
      return { ...state, items: newItems, total, itemCount, lastUpdated: Date.now() };
    }

    case 'REMOVE_ITEM': {
      const { productId, variantKey } = action.payload;
      const keyToMatch = variantKey || productId;

      const newItems = state.items.filter(
        (item) => generateVariantKey(item.product.id, item.variant) !== keyToMatch
      );
      const { total, itemCount } = calculateCartTotals(newItems);
      return { ...state, items: newItems, total, itemCount, lastUpdated: Date.now() };
    }

    case 'UPDATE_QUANTITY': {
      const { productId, quantity, variantKey } = action.payload;
      const keyToMatch = variantKey || productId;

      if (quantity <= 0) {
        return cartReducer(state, { type: 'REMOVE_ITEM', payload: { productId, variantKey } });
      }

      const newItems = state.items.map((item) => {
        const itemKey = generateVariantKey(item.product.id, item.variant);
        return itemKey === keyToMatch ? { ...item, quantity } : item;
      });
      const { total, itemCount } = calculateCartTotals(newItems);
      return { ...state, items: newItems, total, itemCount, lastUpdated: Date.now() };
    }

    case 'UPDATE_ITEM_VARIANT': {
      const { productId, variant, customizations, variantKey } = action.payload;
      const keyToMatch = variantKey || productId;

      const newItems = state.items.map((item) => {
        const itemKey = generateVariantKey(item.product.id, item.variant);
        if (itemKey === keyToMatch) {
          const newTotalPrice = calculateVariantPrice(item.product.price, variant);
          return { ...item, variant, customizations, totalPrice: newTotalPrice };
        }
        return item;
      });

      const { total, itemCount } = calculateCartTotals(newItems);
      return { ...state, items: newItems, total, itemCount, lastUpdated: Date.now() };
    }

    case 'CLEAR_CART':
      return { ...state, items: [], total: 0, itemCount: 0, lastUpdated: Date.now() };

    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen };

    case 'OPEN_CART':
      return { ...state, isOpen: true };

    case 'CLOSE_CART':
      return { ...state, isOpen: false };

    case 'LOAD_CART':
      return action.payload;

    default:
      return state;
  }
}
