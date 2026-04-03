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

type ConfirmEmailResult = {
	success: boolean
	message?: string
}

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

			// Strapi возвращает jwt и user в ответе
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

			// Strapi возвращает jwt и user в ответе
			return result
		} catch (error) {
			// Если это сетевая ошибка или другая ошибка
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

	/**
	 * Обновляет access token используя refresh token из cookie
	 * POST /api/auth/refresh
	 */
	refreshToken: async (): Promise<{ jwt: string }> => {
		try {
			// credentials: 'include' отправляет cookies (включая refreshToken)
			const response = await fetch(`${API_URL}/api/auth/refresh`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include', // Важно для отправки cookies
			})

			const result = await response.json()

			if (!response.ok || isStrapiError(result)) {
				const error = isStrapiError(result)
					? result
					: {
							error: {
								status: response.status,
								message: result.message || 'Не удалось обновить токен',
							},
					  }
				throw error
			}

			// Возвращаем объект с jwt
			return { jwt: result.jwt }
		} catch (error) {
			throw error
		}
	},

	resendConfirmationEmail: async (email: string): Promise<ConfirmEmailResult> => {
		const response = await fetch(`${API_URL}/api/auth/resend-confirmation`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({ email }),
		})

		const result = await response.json().catch(() => ({}))

		if (!response.ok) {
			throw new Error(result?.message || result?.error?.message || 'Не удалось отправить письмо подтверждения')
		}

		return {
			success: true,
			message: result?.message || 'Письмо подтверждения отправлено',
		}
	},

	confirmEmail: async (confirmationToken: string): Promise<ConfirmEmailResult> => {
		const params = new URLSearchParams()
		params.set('confirmation', confirmationToken)
		const response = await fetch(`${API_URL}/api/auth/confirm-email?${params.toString()}`, {
			method: 'GET',
			credentials: 'include',
		})

		if (!response.ok) {
			const result = await response.json().catch(() => ({}))
			throw new Error(result?.message || result?.error?.message || 'Не удалось подтвердить email')
		}

		return { success: true, message: 'Email подтвержден' }
	},
}
