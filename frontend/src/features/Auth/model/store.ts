import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IUserStoreType } from './types'

export const useAuthStore = create<IUserStoreType>()(
	persist(
		(set, get) => ({
			user: null,
			jwt: null, // Access token - хранится только в памяти, не в localStorage
			isAuthenticated: false,
			isLoading: false,
			error: null,

			setUser: (user) => {
				const state = get()
				// Синхронизируем isAuthenticated: true только если есть user И jwt
				const shouldBeAuthenticated = !!user && !!state.jwt
				set({ user, isAuthenticated: shouldBeAuthenticated })
			},
			setJwt: (jwt: string | null) => {
				const state = get()
				set({ jwt })
				// Синхронизируем isAuthenticated: true только если есть user И jwt
				if (state.user) {
					set({ isAuthenticated: !!jwt })
				} else if (!jwt) {
					// Если нет user и нет jwt, гарантируем isAuthenticated = false
					set({ isAuthenticated: false })
				}
			},
			setLoading: (isLoading: boolean) => set({ isLoading }),
			setError: (error: string | null) => set({ error }),
			logout: () => {
				// Гарантируем полную очистку всех данных
				set({ 
					user: null, 
					jwt: null, 
					isAuthenticated: false,
					error: null
				})
			},
		}),
		{
			name: 'auth-storage',
			// Сохраняем user и jwt в localStorage для сохранения сессии при перезагрузке
			partialize: (state) => ({
				user: state.user,
				jwt: state.jwt,
				// isAuthenticated НЕ сохраняется - вычисляется динамически
			}),
			// При восстановлении из localStorage
			onRehydrateStorage: () => (state) => {
				if (state) {
					// Синхронизируем isAuthenticated на основе user и jwt
					if (state.user && state.jwt) {
						state.isAuthenticated = true
						if (process.env.NODE_ENV === 'development') {
							console.log('[AuthStore] Rehydrated: user and jwt found, isAuthenticated = true')
						}
					} else {
						state.isAuthenticated = false
						if (process.env.NODE_ENV === 'development') {
							console.log('[AuthStore] Rehydrated: no user or jwt, isAuthenticated = false')
						}
					}
				}
			},
		}
	)
)
