import { create } from 'zustand';

type User = { id: string; email: string; name: string; role: string };

type AuthState = {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: (token, user) => {
    if (typeof window !== 'undefined') localStorage.setItem('token', token);
    set({ token, user });
  },
  logout: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    set({ token: null, user: null });
    if (typeof window !== 'undefined') window.location.href = '/login';
  },
}));