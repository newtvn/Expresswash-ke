import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Business } from '@/types/business';
import { BUSINESS_ALL } from '@/types/business';
import { listBusinesses } from '@/services/accounting/businesses';

interface BusinessState {
  businesses: Business[];
  selectedBusiness: string; // slug | BUSINESS_ALL
  loaded: boolean;
  setSelectedBusiness: (slug: string) => void;
  loadBusinesses: () => Promise<void>;
}

export const useBusinessStore = create<BusinessState>()(
  persist(
    (set) => ({
      businesses: [],
      selectedBusiness: 'expresswash',
      loaded: false,

      setSelectedBusiness: (slug) => set({ selectedBusiness: slug }),

      loadBusinesses: async () => {
        const businesses = await listBusinesses();
        set({ businesses, loaded: true });
      },
    }),
    {
      name: 'expresswash-business',
      partialize: (state) => ({ selectedBusiness: state.selectedBusiness }),
    }
  )
);

export { BUSINESS_ALL };
