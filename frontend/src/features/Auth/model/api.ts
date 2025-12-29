import type {
	RegisterFormData,
	LoginFormData,
} from '@shared/lib/validations/auth'
import type { ProfileFormData } from '@shared/lib/validations/profile'
import type { IUserType } from './types'
import { isStrapiError } from '@/shared/lib/errors/authErrors'

const API_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL ||
	process.env.NEXT_STRAPI_URL ||
	'http://localhost:1337'

export const strapiAuth = {
	register: async (data: RegisterFormData) => {
		try {
			const requestBody = {
				username: data.email,
				email: data.email,
				password: data.password,
				firstName: data.name,
				phone: data.phone,
			}

			// credentials: 'include' позволяет отправлять cookies (включая refresh token)
			const response = await fetch(`${API_URL}/api/auth/local/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include', // Важно для отправки cookies
				body: JSON.stringify(requestBody),
			})

			const result = await response.json()

			if (isStrapiError(result)) {
				// Выбрасываем весь объект ошибки для правильной обработки
				throw result
			}

			// Refresh token устанавливается сервером в HTTP-only cookie
			// Access token (jwt) возвращается в ответе
			return result
		} catch (error) {
			throw error
		}
	},

	login: async (data: LoginFormData) => {
		try {
			// credentials: 'include' позволяет отправлять cookies (включая refresh token)
			const response = await fetch(`${API_URL}/api/auth/local`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include', // Важно для отправки cookies
				body: JSON.stringify({
					identifier: data.email,
					password: data.password,
				}),
			})

			const result = await response.json()

			// Если это ошибка, выбрасываем весь объект ошибки для правильной обработки
			if (isStrapiError(result)) {
				throw result
			}

			// Refresh token устанавливается сервером в HTTP-only cookie
			// Access token (jwt) возвращается в ответе
			return result
		} catch (error) {
			// Если это сетевая ошибка или другая ошибка
			throw error
		}
	},

	/**
	 * Обновляет access token используя refresh token из cookie
	 */
	refreshToken: async (): Promise<{ jwt: string }> => {
		try {
			// credentials: 'include' автоматически отправляет refresh token из HTTP-only cookie
			const response = await fetch(`${API_URL}/api/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
			})

			if (!response.ok) {
				throw new Error('Не удалось обновить токен')
			}

			const result = await response.json()

			if (isStrapiError(result)) {
				throw new Error(result.error?.message || 'Ошибка обновления токена')
			}

			return result
		} catch (error) {
			throw error
		}
	},

	getMe: async (jwt: string): Promise<IUserType> => {
		try {
			const { fetchWithAuth } = await import('@/shared/lib/apiClient')
			const response = await fetchWithAuth('/api/users/me', {
				method: 'GET',
				accessToken: jwt,
			})

			if (!response.ok) {
				throw new Error('Не удалось получить данные пользователя')
			}

			const result = await response.json()

			// Если это ошибка, выбрасываем её
			if (isStrapiError(result)) {
				throw new Error(result.error?.message || 'Ошибка сервера')
			}

			return result as IUserType
		} catch (error) {
			// Если это сетевая ошибка или другая ошибка
			throw error
		}
	},

	updateProfile: async (
		data: ProfileFormData,
		jwt: string
	): Promise<IUserType> => {
		try {
			const { fetchWithAuth } = await import('@/shared/lib/apiClient')
			const response = await fetchWithAuth('/api/users/me', {
				method: 'PUT',
				accessToken: jwt,
				body: JSON.stringify({
					firstName: data.name,
					phone: data.phone,
				}),
			})

			if (!response.ok) {
				throw new Error('Не удалось обновить профиль')
			}

			const result = await response.json()

			// Если это ошибка, выбрасываем её
			if (isStrapiError(result)) {
				throw new Error(result.error?.message || 'Ошибка сервера')
			}

			return result as IUserType
		} catch (error) {
			// Если это сетевая ошибка или другая ошибка
			throw error
		}
	},

	/**
	 * Удаляет текущий аккаунт пользователя и все связанные данные
	 */
	deleteAccount: async (jwt: string): Promise<{ success: boolean; message: string }> => {
		try {
			const { fetchWithAuth } = await import('@/shared/lib/apiClient')
			const response = await fetchWithAuth('/api/users/me', {
				method: 'DELETE',
				accessToken: jwt,
			})

			if (!response.ok) {
				throw new Error('Не удалось удалить аккаунт')
			}

			const result = await response.json()

			if (isStrapiError(result)) {
				throw new Error(result.error?.message || 'Ошибка удаления аккаунта')
			}

			return result
		} catch (error) {
			throw error
		}
	},
}
