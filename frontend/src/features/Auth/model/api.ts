import type {
	RegisterFormData,
	LoginFormData,
} from '@shared/lib/validations/auth'
import type { ProfileFormData } from '@shared/lib/validations/profile'
import type { IUserType } from './types'
import { isStrapiError } from '@/shared/lib/errors/authErrors'

const API_URL = process.env.NEXT_STRAPI_URL || 'http://localhost:1337'

export const strapiAuth = {
	register: async (data: RegisterFormData) => {
		try {
			const response = await fetch(`${API_URL}/api/auth/local/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: data.email,
					email: data.email,
					password: data.password,
					firstName: data.name,
					phone: data.phone,
				}),
			})

			const result = await response.json()

			// Если это ошибка, выбрасываем её
			if (isStrapiError(result)) {
				throw new Error(result.error?.message || 'Ошибка сервера')
			}

			return result
		} catch (error) {
			// Если это сетевая ошибка или другая ошибка
			throw error
		}
	},

	login: async (data: LoginFormData) => {
		try {
			const response = await fetch(`${API_URL}/api/auth/local`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					identifier: data.email,
					password: data.password,
				}),
			})

			const result = await response.json()

			// Если это ошибка, выбрасываем её
			if (isStrapiError(result)) {
				throw new Error(result.error?.message || 'Ошибка сервера')
			}

			return result
		} catch (error) {
			// Если это сетевая ошибка или другая ошибка
			throw error
		}
	},

	getMe: async (jwt: string): Promise<IUserType> => {
		try {
			const response = await fetch(`${API_URL}/api/users/me`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${jwt}`,
				},
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

	updateProfile: async (data: ProfileFormData, jwt: string): Promise<IUserType> => {
		try {
			const response = await fetch(`${API_URL}/api/users/me`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${jwt}`,
				},
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
}
