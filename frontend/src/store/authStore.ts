import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearAuthCookies, setAuthCookies } from '@/lib/authCookies';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  institution?: string;
  country: string;
  role: 'user' | 'admin' | 'analyst';
  avatar_url?: string;
  is_verified: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User) => void;
  setTokens: (access: string, refresh: string) => void;
  login: (user: User, access: string, refresh: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  updateProfile: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      setUser: (user) => set({ user }),
      setTokens: (access, refresh) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access);
          localStorage.setItem('refresh_token', refresh);
        }
        set({ accessToken: access, refreshToken: refresh });
      },
      login: (user, access, refresh) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', access);
          localStorage.setItem('refresh_token', refresh);
          setAuthCookies(user.role);
        }
        set({ user, accessToken: access, refreshToken: refresh, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          clearAuthCookies();
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
      setLoading: (loading) => set({ isLoading: loading }),
      updateProfile: (data) => set((state) => ({
        user: state.user ? { ...state.user, ...data } : null,
      })),
    }),
    {
      name: 'velora-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.isLoading = false;
      },
    },
  ),
);
