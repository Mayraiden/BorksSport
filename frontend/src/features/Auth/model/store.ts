import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IUserStoreType } from './types'

export const useAuthStore = create<IUserStoreType>()(
	persist(
		(set) => ({
			user: null,
			jwt: null, // Access token - хранится только в памяти, не в localStorage
			isAuthenticated: false,
			isLoading: false,
			error: null,

			setUser: (user) => set({ user, isAuthenticated: !!user }),
			setJwt: (jwt: string | null) => set({ jwt }),
			setLoading: (isLoading: boolean) => set({ isLoading }),
			setError: (error: string | null) => set({ error }),
			logout: () => set({ user: null, jwt: null, isAuthenticated: false }),
		}),
		{
			name: 'auth-storage',
			// Исключаем jwt (access token) из сохранения в localStorage
			// Access token должен храниться только в памяти
			partialize: (state) => ({
				user: state.user,
				isAuthenticated: state.isAuthenticated,
				// jwt НЕ сохраняется - только в памяти
			}),
		}
	)
)
