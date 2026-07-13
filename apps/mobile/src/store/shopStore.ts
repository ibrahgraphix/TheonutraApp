import { create } from 'zustand';

interface ShopState {
  /** Session-only browse country; does not change the user's profile. */
  browseCountry: string | null;
  initBrowseCountry: (country: string) => void;
  setBrowseCountry: (country: string) => void;
  resetBrowseCountry: () => void;
}

export const useShopStore = create<ShopState>((set) => ({
  browseCountry: null,

  initBrowseCountry: (country) => set({ browseCountry: country }),

  setBrowseCountry: (country) => set({ browseCountry: country }),

  resetBrowseCountry: () => set({ browseCountry: null }),
}));
