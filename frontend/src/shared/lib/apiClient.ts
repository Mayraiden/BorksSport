/**
 * API Client с автоматическим обновлением токенов
 * 
 * Эта утилита перехватывает 401 ошибки и автоматически обновляет access token
 * используя refresh token из HTTP-only cookie
 */

import { strapiAuth } from '@/features/Auth/model/api'
import { useAuthStore } from '@/features/Auth/model/store'

const API_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL ||
	process.env.NEXT_STRAPI_URL ||
	'http://localhost:1337'

/**
 * Выполняет fetch запрос с автоматическим обновлением токена при 401 ошибке
 */
export async function fetchWithAuth(
	url: string,
	options: RequestInit & { accessToken?: string | null } = {}
): Promise<Response> {
	const { accessToken, ...fetchOptions } = options

	// Добавляем access token в заголовки если он есть
	const headers = new Headers(fetchOptions.headers)
	if (accessToken) {
		headers.set('Authorization', `Bearer ${accessToken}`)
	}
	// Устанавливаем Content-Type только если он не был установлен
	if (!headers.has('Content-Type')) {
		headers.set('Content-Type', 'application/json')
	}

	const response = await fetch(`${API_URL}${url}`, {
		...fetchOptions,
		headers,
		credentials: 'include', // Отправляем cookies (refresh token)
	})

	// Если получили 401, пытаемся обновить токен
	if (response.status === 401 && accessToken) {
		try {
			// Пытаемся обновить access token
			const refreshResult = await strapiAuth.refreshToken()
			const newAccessToken = refreshResult.jwt

			// Обновляем токен в store
			useAuthStore.getState().setJwt(newAccessToken)

			// Повторяем оригинальный запрос с новым токеном
			headers.set('Authorization', `Bearer ${newAccessToken}`)
			const retryResponse = await fetch(`${API_URL}${url}`, {
				...fetchOptions,
				headers,
				credentials: 'include',
			})

			return retryResponse
		} catch {
			// Если refresh token тоже невалиден, разлогиниваем пользователя
			useAuthStore.getState().logout()
			throw new Error('Сессия истекла. Пожалуйста, войдите снова.')
		}
	}

	return response
}

