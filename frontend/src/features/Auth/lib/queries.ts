import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { strapiAuth } from '../model/api'
import { useAuthStore } from '../model/store'
import { getAuthErrorMessage } from '@/shared/lib/errors/authErrors'
import type { ProfileFormData } from '@shared/lib/validations/profile'

export const useLogin = () => {
	return useMutation({
		mutationFn: strapiAuth.login,
		onSuccess: (data) => {
			if (data.user && data.jwt) {
				useAuthStore.getState().setUser(data.user)
				useAuthStore.getState().setJwt(data.jwt)
				useAuthStore.getState().setError(null)
			}
		},
		onError: (error: unknown) => {
			const errorMessage = getAuthErrorMessage(error)
			useAuthStore.getState().setError(errorMessage)
		},
	})
}

export const useRegister = () => {
	return useMutation({
		mutationFn: strapiAuth.register,
		onSuccess: (data) => {
			if (data.user && data.jwt) {
				useAuthStore.getState().setUser(data.user)
				useAuthStore.getState().setJwt(data.jwt)
				useAuthStore.getState().setError(null)
			}
		},
		onError: (error: unknown) => {
			const errorMessage = getAuthErrorMessage(error)
			useAuthStore.getState().setError(errorMessage)
		},
	})
}

export const useGetMe = () => {
	const jwt = useAuthStore((state) => state.jwt)
	const setUser = useAuthStore((state) => state.setUser)

	const query = useQuery({
		queryKey: ['user', 'me'],
		queryFn: () => {
			if (!jwt) {
				throw new Error('JWT токен отсутствует')
			}
			return strapiAuth.getMe(jwt)
		},
		enabled: !!jwt,
		retry: false,
	})

	// Используем useEffect вместо onSuccess (React Query v5)
	useEffect(() => {
		if (query.data) {
			setUser(query.data)
		}
	}, [query.data, setUser])

	return query
}

export const useUpdateProfile = () => {
	const jwt = useAuthStore((state) => state.jwt)
	const setUser = useAuthStore((state) => state.setUser)
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: (data: ProfileFormData) => {
			if (!jwt) {
				throw new Error('JWT токен отсутствует')
			}
			return strapiAuth.updateProfile(data, jwt)
		},
		onSuccess: (user) => {
			setUser(user)
			queryClient.invalidateQueries({ queryKey: ['user', 'me'] })
		},
		onError: (error: unknown) => {
			const errorMessage = getAuthErrorMessage(error)
			useAuthStore.getState().setError(errorMessage)
		},
	})
}

export const useDeleteAccount = () => {
	const jwt = useAuthStore((state) => state.jwt)
	const logout = useAuthStore((state) => state.logout)
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: () => {
			if (!jwt) {
				throw new Error('JWT токен отсутствует')
			}
			return strapiAuth.deleteAccount(jwt)
		},
		onSuccess: () => {
			// Очищаем все данные пользователя
			logout()
			// Очищаем кэш React Query
			queryClient.clear()
		},
		onError: (error: unknown) => {
			const errorMessage = getAuthErrorMessage(error)
			useAuthStore.getState().setError(errorMessage)
		},
	})
}
