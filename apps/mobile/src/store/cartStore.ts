import { create } from 'zustand';

import type { CartItem } from '../types';

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setItemQuantity: (item: CartItem) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  getCurrency: () => string | null;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item, quantity = 1) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity }] };
    });
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.productId !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity < 1) {
      get().removeItem(productId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, quantity } : i,
      ),
    }));
  },

  setItemQuantity: (item) => {
    set((state) => {
      const filtered = state.items.filter((i) => i.productId !== item.productId);
      return { items: [...filtered, item] };
    });
  },

  clearCart: () => set({ items: [] }),

  getTotal: () =>
    get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

  getItemCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  getCurrency: () => get().items[0]?.currency ?? null,
}));
