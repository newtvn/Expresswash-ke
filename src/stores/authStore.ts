import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole, JWTTokens } from '@/types';
import { supabase } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  tokens: JWTTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: User, tokens: JWTTokens) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  initSession: () => Promise<void>;

  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  isCustomer: () => boolean;
  isDriver: () => boolean;
  isWarehouseStaff: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: true,

      setAuth: (user, tokens) =>
        set({
          user,
          tokens,
          isAuthenticated: true,
        }),

      clearAuth: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      initSession: async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              // Block inactive/deactivated users
              if (profile.is_active === false) {
                await supabase.auth.signOut();
                set({ user: null, tokens: null, isAuthenticated: false });
                return;
              }

              const user: User = {
                id: profile.id,
                email: profile.email,
                name: profile.name ?? '',
                role: profile.role as UserRole,
                phone: profile.phone ?? undefined,
                zone: profile.zone ?? undefined,
                avatarUrl: profile.avatar_url ?? undefined,
                isActive: profile.is_active ?? true,
                createdAt: profile.created_at ?? '',
                lastLoginAt: profile.last_login_at ?? undefined,
              };
              const tokens: JWTTokens = {
                accessToken: session.access_token,
                refreshToken: session.refresh_token,
              };
              set({ user, tokens, isAuthenticated: true });
            }
          } else {
            set({ user: null, tokens: null, isAuthenticated: false });
          }
        } catch {
          set({ user: null, tokens: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      hasRole: (role) => get().user?.role === role,

      hasAnyRole: (roles) => {
        const userRole = get().user?.role;
        return userRole ? roles.includes(userRole) : false;
      },

      isAdmin: () => {
        const role = get().user?.role;
        return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
      },

      isCustomer: () => get().user?.role === UserRole.CUSTOMER,
      isDriver: () => get().user?.role === UserRole.DRIVER,
      isWarehouseStaff: () => get().user?.role === UserRole.WAREHOUSE_STAFF,
    }),
    {
      name: 'expresswash-auth',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Listen for auth state changes (token refresh, sign-out from another tab, etc.)
supabase.auth.onAuthStateChange(async (event, session) => {
  const store = useAuthStore.getState();

  if (event === 'SIGNED_OUT' || !session) {
    store.clearAuth();
    return;
  }

  // Safe token refresh — only if user still exists in store
  if (event === 'TOKEN_REFRESHED' && session && store.user) {
    store.setAuth(
      store.user,
      { accessToken: session.access_token, refreshToken: session.refresh_token },
    );
  }

  // Handle OAuth callback (e.g. Google sign-in) — populate store from profile
  if (event === 'SIGNED_IN' && session && !store.user) {
    try {
      // Retry profile fetch — DB trigger may not have created it yet for new OAuth users
      let profile = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (p) {
          profile = p;
          break;
        }
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }

      if (profile) {
        const user: User = {
          id: profile.id,
          email: profile.email,
          name: profile.name ?? '',
          role: profile.role as UserRole,
          phone: profile.phone ?? undefined,
          zone: profile.zone ?? undefined,
          avatarUrl: profile.avatar_url ?? undefined,
          isActive: profile.is_active ?? true,
          createdAt: profile.created_at ?? '',
          lastLoginAt: profile.last_login_at ?? undefined,
        };

        // Block inactive users
        if (!user.isActive) {
          await supabase.auth.signOut();
          store.clearAuth();
          return;
        }

        store.setAuth(
          user,
          { accessToken: session.access_token, refreshToken: session.refresh_token },
        );
      }
    } catch {
      // Profile fetch failed — initSession will retry on next load
    }
  }
});
