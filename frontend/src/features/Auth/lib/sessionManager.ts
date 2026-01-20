/**
 * SessionManager - единый сервис управления сессией
 * 
 * Координирует все операции восстановления и разлогина,
 * предотвращает race conditions и множественные точки принятия решений.
 */

import { strapiAuth } from '../model/api'
import { useAuthStore } from '../model/store'
import type { IUserType } from '../model/types'

// Типы ошибок для правильной обработки
export enum ErrorType {
	AUTH_ERROR = 'AUTH_ERROR', // 401/403 - токен невалидный
	NETWORK_ERROR = 'NETWORK_ERROR', // Сетевые ошибки
	SERVER_ERROR = 'SERVER_ERROR', // 500 ошибки
	UNKNOWN_ERROR = 'UNKNOWN_ERROR', // Другие ошибки
}

interface RestoreError extends Error {
	type: ErrorType
	status?: number
	retryable: boolean
}

class SessionManager {
	private restorePromise: Promise<{ jwt: string; user: IUserType } | null> | null = null
	private isRestoringFlag = false

	/**
	 * Проверяет, идет ли восстановление сессии
	 */
	isRestoring(): boolean {
		return this.isRestoringFlag || useAuthStore.getState().isRestoring
	}

	/**
	 * Определяет тип ошибки для правильной обработки
	 */
	private classifyError(error: unknown): RestoreError {
		if (error instanceof Error) {
			const message = error.message.toLowerCase()
			const status = (error as Error & { status?: number }).status

			// Авторизационные ошибки (401/403)
			if (
				status === 401 ||
				status === 403 ||
				message.includes('401') ||
				message.includes('403') ||
				message.includes('unauthorized') ||
				message.includes('forbidden') ||
				message.includes('expired') ||
				message.includes('invalid') ||
				message.includes('токен') ||
				message.includes('сессия истекла')
			) {
				return {
					...error,
					type: ErrorType.AUTH_ERROR,
					status: status || 401,
					retryable: false,
				} as RestoreError
			}

			// Сетевые ошибки
			if (
				message.includes('network') ||
				message.includes('fetch') ||
				message.includes('failed to fetch') ||
				message.includes('networkerror') ||
				message.includes('ошибка сети')
			) {
				return {
					...error,
					type: ErrorType.NETWORK_ERROR,
					retryable: true,
				} as RestoreError
			}

			// Серверные ошибки (500+)
			if (status && status >= 500) {
				return {
					...error,
					type: ErrorType.SERVER_ERROR,
					status,
					retryable: true,
				} as RestoreError
			}
		}

		// Неизвестная ошибка
		return {
			name: 'UnknownError',
			message: error instanceof Error ? error.message : String(error),
			type: ErrorType.UNKNOWN_ERROR,
			retryable: false,
		} as RestoreError
	}

	/**
	 * Определяет, нужно ли разлогинивать при ошибке
	 */
	shouldLogout(error: unknown): boolean {
		const classifiedError = this.classifyError(error)
		// Разлогиниваем только при авторизационных ошибках
		return classifiedError.type === ErrorType.AUTH_ERROR
	}

	/**
	 * Задержка перед повторной попыткой (экспоненциальная)
	 */
	private getRetryDelay(attempt: number): number {
		// 1s, 2s, 4s
		return Math.min(1000 * Math.pow(2, attempt - 1), 4000)
	}

	/**
	 * Восстанавливает сессию с retry логикой
	 * 
	 * @param maxRetries - максимальное количество попыток (по умолчанию 3)
	 * @returns Promise с jwt и user или null если восстановление не удалось
	 */
	async restoreSession(maxRetries: number = 3): Promise<{ jwt: string; user: IUserType } | null> {
		// Если уже идет восстановление, возвращаем существующий promise
		if (this.restorePromise) {
			return this.restorePromise
		}

		const store = useAuthStore.getState()

		// Проверяем наличие user - если есть user, значит пользователь был авторизован
		// refreshToken может быть в HTTP-only cookie, даже если его нет в store
		if (!store.user) {
			if (process.env.NODE_ENV === 'development') {
				console.log('[SessionManager] No user found, cannot restore session')
			}
			return null
		}

		// Если нет refreshToken в store, но есть user - все равно пытаемся восстановить
		// refreshToken может быть в HTTP-only cookie
		if (!store.refreshToken) {
			if (process.env.NODE_ENV === 'development') {
				console.log('[SessionManager] No refreshToken in store, but trying restore with cookie')
			}
		}

		// Устанавливаем флаг восстановления
		this.isRestoringFlag = true
		store.setRestoring(true)

		// Создаем promise для восстановления
		this.restorePromise = this.performRestore(maxRetries)

		try {
			const result = await this.restorePromise
			return result
		} finally {
			this.isRestoringFlag = false
			store.setRestoring(false)
			this.restorePromise = null
		}
	}

	/**
	 * Выполняет восстановление сессии с retry логикой
	 */
	private async performRestore(maxRetries: number): Promise<{ jwt: string; user: IUserType } | null> {
		const store = useAuthStore.getState()

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				if (process.env.NODE_ENV === 'development') {
					console.log(`[SessionManager] Restore attempt ${attempt}/${maxRetries}`)
				}

				// Пытаемся обновить токен
				const refreshResult = await strapiAuth.refreshToken()

				if (!refreshResult?.jwt) {
					throw new Error('Refresh token response missing jwt')
				}

				// Устанавливаем новый JWT
				store.setJwt(refreshResult.jwt)

				if (process.env.NODE_ENV === 'development') {
					console.log('[SessionManager] Token refreshed successfully')
				}

				// Загружаем данные пользователя с retry логикой
				const user = await this.loadUserData(refreshResult.jwt, 3)

				if (!user) {
					throw new Error('Failed to load user data')
				}

				// Устанавливаем пользователя
				store.setUser(user)

				if (process.env.NODE_ENV === 'development') {
					console.log('[SessionManager] Session restored successfully')
				}

				return { jwt: refreshResult.jwt, user }
			} catch (error) {
				const classifiedError = this.classifyError(error)

				if (process.env.NODE_ENV === 'development') {
					console.warn(`[SessionManager] Restore attempt ${attempt} failed:`, {
						type: classifiedError.type,
						message: classifiedError.message,
						retryable: classifiedError.retryable,
					})
				}

				// Если это авторизационная ошибка - не повторяем, разлогиниваем
				if (classifiedError.type === ErrorType.AUTH_ERROR) {
					if (process.env.NODE_ENV === 'development') {
						console.log('[SessionManager] Auth error detected, logging out')
					}
					store.logout()
					return null
				}

				// Если это последняя попытка или ошибка не повторяемая - прекращаем
				if (attempt === maxRetries || !classifiedError.retryable) {
					if (process.env.NODE_ENV === 'development') {
						console.warn('[SessionManager] Max retries reached or non-retryable error')
					}
					// Не разлогиниваем при сетевых/серверных ошибках
					return null
				}

				// Ждем перед следующей попыткой
				const delay = this.getRetryDelay(attempt)
				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}

		return null
	}

	/**
	 * Загружает данные пользователя с retry логикой
	 */
	private async loadUserData(jwt: string, maxRetries: number = 3): Promise<IUserType | null> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const user = await strapiAuth.getMe(jwt)
				return user
			} catch (error) {
				const classifiedError = this.classifyError(error)

				// При авторизационной ошибке - сразу возвращаем null
				if (classifiedError.type === ErrorType.AUTH_ERROR) {
					return null
				}

				// Если это последняя попытка - возвращаем null
				if (attempt === maxRetries) {
					return null
				}

				// Ждем перед следующей попыткой
				const delay = this.getRetryDelay(attempt)
				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}

		return null
	}

	/**
	 * Сбрасывает состояние восстановления (для тестирования или принудительного сброса)
	 */
	reset(): void {
		this.isRestoringFlag = false
		this.restorePromise = null
		useAuthStore.getState().setRestoring(false)
	}
}

// Экспортируем singleton экземпляр
export const sessionManager = new SessionManager()
