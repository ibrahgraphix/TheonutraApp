import { create } from 'zustand';

import * as api from '../services/api';
import type { Distributor } from '../types';
import { useCartStore } from './cartStore';
import { useShopStore } from './shopStore';

interface AuthState {
  distributor: Distributor | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (distributorId: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  updateDistributor: (distributor: Distributor) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  distributor: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (distributorId, password) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await api.login(distributorId, password);
      useShopStore.getState().initBrowseCountry(user.country);
      set({ distributor: user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed.',
      });
      throw error;
    }
  },

  logout: () => {
    useCartStore.getState().clearCart();
    useShopStore.getState().resetBrowseCountry();
    set({ distributor: null, token: null, isAuthenticated: false, error: null });
    api.setAuthToken(null);
  },

  clearError: () => set({ error: null }),

  updateDistributor: (distributor) => set({ distributor }),
}));
