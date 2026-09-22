'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart, CartItem } from '@/components/CartContext';
import { formatPrice, productImageSrc, cartItemLineTotal } from '@/lib/commerce';

export function CartDrawer() {
  const { state, removeItem, updateQuantity, closeCart, getItemKey } = useCart();
  const pathname = usePathname();
  const drawerBlocked = pathname === '/checkout' || pathname.startsWith('/checkout/');

  useEffect(() => {
    if (state.isOpen && drawerBlocked) {
      closeCart();
    }
  }, [pathname, drawerBlocked, state.isOpen, closeCart]);

  useEffect(() => {
    if (!state.isOpen || drawerBlocked) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [state.isOpen, drawerBlocked]);

  if (!state.isOpen || drawerBlocked) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={closeCart}
        aria-hidden="true"
      />

      <div
        className="fixed right-0 top-0 h-full w-full max-w-sm sm:max-w-md bg-white shadow-xl z-50 transition-transform duration-300 ease-out"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Shopping Cart ({state.itemCount})
            </h2>
            <button
              type="button"
              onClick={closeCart}
              className="tap-target rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {state.items.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 018 0v4M5 9h38l-2 13H7L5 9z" />
                </svg>
                <p className="text-gray-500 mb-4">Your cart is empty</p>
                <Link
                  href="/shop"
                  onClick={closeCart}
                  className="inline-flex min-h-11 items-center bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Continue Shopping
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {state.items.map((item) => {
                  const itemKey = getItemKey(item.product.id, item.variant);
                  return (
                    <CartItemCard
                      key={itemKey}
                      item={item}
                      onRemove={() => removeItem(item.product.id, itemKey)}
                      onUpdateQuantity={(quantity) => updateQuantity(item.product.id, quantity, itemKey)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {state.items.length > 0 && (
            <div className="border-t border-gray-200 p-4 sm:p-6 space-y-4 safe-area-bottom">
              <div className="flex justify-between items-center text-lg font-semibold">
                <span>Total:</span>
                <span>{formatPrice(state.total)}</span>
              </div>
              <p className="text-sm text-gray-500">
                Shipping and taxes calculated at checkout
              </p>
              <div className="space-y-2">
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  data-testid="proceed-to-checkout"
                  className="w-full min-h-11 inline-flex items-center justify-center bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium"
                >
                  Proceed to Checkout
                </Link>
                <Link
                  href="/shop"
                  onClick={closeCart}
                  className="w-full min-h-11 inline-flex items-center justify-center border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Continue Shopping
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CartItemCard({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}) {
  const { product, quantity, variant } = item;

  return (
    <div className="flex gap-4 p-4 border border-gray-200 rounded-lg">
      <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        <Image
          src={productImageSrc(product)}
          alt={product.title}
          fill
          className="object-cover"
          sizes="80px"
        />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-900 text-sm mb-1 truncate">
          {product.title}
        </h3>
        <p className="text-xs text-gray-500 mb-1">{product.medium}</p>
        <p className="text-xs text-gray-500 mb-2">{product.dimensions}</p>

        {variant && (
          <div className="text-xs text-gray-600 mb-2">
            {variant.framing && <p>Framing: {variant.framing.name}</p>}
            {variant.size && <p>Size: {variant.size.name}</p>}
            {variant.material && <p>Material: {variant.material.name}</p>}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center border border-gray-300 rounded">
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity - 1)}
              className="tap-target rounded-l hover:bg-gray-100 transition-colors disabled:opacity-40"
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="min-w-[2.5rem] text-center text-sm font-medium">{quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity + 1)}
              className="tap-target rounded-r hover:bg-gray-100 transition-colors"
              aria-label="Increase quantity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="tap-target text-red-600 hover:text-red-800 transition-colors"
            aria-label="Remove item"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="font-medium text-gray-900">{formatPrice(cartItemLineTotal(item))}</p>
        {quantity > 1 && (
          <p className="text-xs text-gray-500">{formatPrice(item.totalPrice)} each</p>
        )}
      </div>
    </div>
  );
}
