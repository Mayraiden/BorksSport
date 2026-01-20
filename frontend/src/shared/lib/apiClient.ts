/**
 * API Client для выполнения запросов с JWT токеном
 * Обрабатывает 401 ошибки (истекший токен) - разлогинивает и уведомляет пользователя
 */

import { useAuthStore } from '@/features/Auth/model/store'

const API_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL ||
	process.env.NEXT_STRAPI_URL ||
	'http://localhost:1337'

// Флаг для предотвращения множественных одновременных обработок 401
let isHandling401 = false

/**
 * Выполняет fetch запрос с JWT токеном в заголовках
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
		credentials: 'include',
	})

	// Если получили 401 (токен истек или невалидный)
	if (response.status === 401 && accessToken) {
		// Предотвращаем множественные обработки
		if (!isHandling401) {
			isHandling401 = true

			// Разлогиниваем пользователя
			const store = useAuthStore.getState()
			store.logout()

			// Показываем уведомление пользователю
			if (typeof window !== 'undefined') {
				alert('Ваша сессия истекла. Пожалуйста, войдите в аккаунт снова.')
				
				// Редиректим на страницу логина
				if (window.location.pathname !== '/auth') {
					window.location.href = '/auth'
				}
			}

			// Сбрасываем флаг через небольшую задержку
			setTimeout(() => {
				isHandling401 = false
			}, 1000)
		}
	}

	return response
}

