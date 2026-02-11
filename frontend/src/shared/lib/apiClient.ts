/**
 * API Client для выполнения запросов с JWT токеном
 * Обрабатывает 401 ошибки (истекший токен) - разлогинивает и уведомляет пользователя
 * Безопасная обработка ошибок парсинга JSON и защита от XSS
 */

import { useAuthStore } from '@/features/Auth/model/store'
import { safeParseJSON } from '@/shared/lib/safeUtils'
import { securityLogger } from '@/shared/lib/securityLogger'

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

	// Логируем подозрительные ответы (например, очень большие ответы)
	if (response.headers.get('content-length')) {
		const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
		if (contentLength > 10 * 1024 * 1024) {
			// Ответ больше 10MB - подозрительно
			securityLogger.logSuspiciousActivity('LARGE_RESPONSE', {
				url,
				size: contentLength,
				status: response.status,
			})
		}
	}

	return response
}

/**
 * Безопасный парсинг JSON ответа с защитой от XSS
 */
export async function safeJsonResponse<T = unknown>(
	response: Response
): Promise<T | null> {
	try {
		const text = await response.text()
		
		// Базовая проверка на подозрительный контент
		if (text.includes('<script') || text.includes('javascript:')) {
			securityLogger.logSuspiciousActivity('POTENTIAL_XSS_IN_RESPONSE', {
				url: response.url,
				status: response.status,
				preview: text.substring(0, 200),
			})
			return null
		}

		// Безопасный парсинг JSON
		const parsed = safeParseJSON<T>(text, null)
		
		if (parsed === null && text.trim() !== '') {
			securityLogger.logError(
				new Error('Failed to parse JSON response'),
				{
					url: response.url,
					status: response.status,
					preview: text.substring(0, 200),
				}
			)
		}

		return parsed
	} catch (error) {
		securityLogger.logError(error, {
			url: response.url,
			status: response.status,
		})
		return null
	}
}
