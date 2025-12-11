import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IUserStoreType } from './types'

export const useAuthStore = create<IUserStoreType>()(
	persist(
		(set) => ({
			user: null,
			jwt: null,
			isAuthenticated: false,
			isLoading: false,
			error: null,

			setUser: (user) => set({ user, isAuthenticated: !!user }),
			setJwt: (jwt: string | null) => set({ jwt }),
			setLoading: (isLoading: boolean) => set({ isLoading }),
			setError: (error: string | null) => set({ error }),
			logout: () => set({ user: null, jwt: null, isAuthenticated: false }),
		}),
		{ name: 'auth-storage' }
	)
)
