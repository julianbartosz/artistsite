'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCart, CartItem } from '@ui/components/cart/context/CartContext';
import { formatPrice } from '@domain/shop';
import { IconClose, IconMinus, IconPlus, IconTrash } from '@ui/icons/actions';
import { IconCart } from '@ui/icons/commerce';

export function CartDrawer() {
  const { state, removeItem, updateQuantity, closeCart, getItemKey } = useCart();
  if (!state.isOpen) return null;
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={closeCart}
      />
      
      {/* Cart Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Shopping Cart ({state.itemCount})
            </h2>
            <button
              onClick={closeCart}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close cart"
            >
              <IconClose className="w-5 h-5" />
            </button>
          </div>
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-6">
            {state.items.length === 0 ? (
              <div className="text-center py-8">
                <IconCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">Your cart is empty</p>
                <Link 
                  href="/shop"
                  onClick={closeCart}
                  className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
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

          {/* Footer */}
          {state.items.length > 0 && (
            <div className="border-t border-gray-200 p-6 space-y-4">
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
                  className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium text-center block"
                >
                  Proceed to Checkout
                </Link>
                <Link
                  href="/shop"
                  onClick={closeCart}
                  className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium text-center block"
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
  onUpdateQuantity 
}: { 
  item: CartItem;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}) {
  const { product, quantity, variant } = item;
  return (
    <div className="flex gap-4 p-4 border border-gray-200 rounded-lg">
      {/* Product Image */}
      <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
        <Image
          src={product.images.thumbnail}
          alt={product.title}
          fill
          className="object-cover"
          sizes="80px"
        />
      </div>

      {/* Product Info */}
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

        {/* Quantity Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center border border-gray-300 rounded">
            <button
              onClick={() => onUpdateQuantity(quantity - 1)}
              className="p-1 hover:bg-gray-100 transition-colors"
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
            >
              <IconMinus />
            </button>
            <span className="px-3 py-1 text-sm font-medium">{quantity}</span>
            <button
              onClick={() => onUpdateQuantity(quantity + 1)}
              className="p-1 hover:bg-gray-100 transition-colors"
              aria-label="Increase quantity"
            >
              <IconPlus />
            </button>
          </div>
          
          <button
            onClick={onRemove}
            className="text-red-600 hover:text-red-800 transition-colors"
            aria-label="Remove item"
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="text-right">
        <p className="font-medium text-gray-900">{formatPrice(product.price * quantity)}</p>
        {quantity > 1 && (
          <p className="text-xs text-gray-500">{formatPrice(product.price)} each</p>
        )}
      </div>
    </div>
  );
}
