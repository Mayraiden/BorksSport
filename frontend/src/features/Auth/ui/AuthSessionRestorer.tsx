'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '../model/store'
import { strapiAuth } from '../model/api'

/**
 * Компонент для восстановления сессии при загрузке приложения и при потере JWT
 * Если пользователь был авторизован (isAuthenticated=true из localStorage),
 * но JWT токен отсутствует (потерян при перезагрузке страницы или навигации),
 * пытается восстановить его через refresh token из HTTP-only cookie
 * 
 * Теперь работает непрерывно - мониторит состояние JWT и восстанавливает при необходимости
 */
export const AuthSessionRestorer = () => {
	const { isAuthenticated, jwt, setJwt, setUser, logout } = useAuthStore()
	const isRestoring = useRef(false)
	const lastJwtRef = useRef<string | null>(null)
	const restoreTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	useEffect(() => {
		// Если пользователь авторизован, но JWT отсутствует - пытаемся восстановить
		if (isAuthenticated && !jwt) {
			// Проверяем, изменилось ли состояние (JWT был, но стал null)
			const jwtWasLost = lastJwtRef.current !== null && jwt === null
			
			// Если уже идет процесс восстановления, пропускаем
			if (isRestoring.current) return

			// Debounce: если JWT только что потерялся, ждем немного перед восстановлением
			if (jwtWasLost && restoreTimeoutRef.current) {
				clearTimeout(restoreTimeoutRef.current)
			}

			const restoreSession = async () => {
				if (isRestoring.current) return
				
				try {
					isRestoring.current = true
					
					if (process.env.NODE_ENV === 'development') {
						console.log('[AuthSessionRestorer] Attempting to restore session...')
					}
					
					// Пытаемся обновить токен через refresh token из cookie
					const refreshResult = await strapiAuth.refreshToken()
					
					if (refreshResult?.jwt) {
						// Успешно восстановили токен
						setJwt(refreshResult.jwt)
						lastJwtRef.current = refreshResult.jwt
						
						if (process.env.NODE_ENV === 'development') {
							console.log('[AuthSessionRestorer] Token refreshed successfully')
						}
						
						// Загружаем данные пользователя
						try {
							const user = await strapiAuth.getMe(refreshResult.jwt)
							setUser(user)
							
							if (process.env.NODE_ENV === 'development') {
								console.log('[AuthSessionRestorer] User data loaded successfully')
							}
						} catch (userError) {
							console.error('[AuthSessionRestorer] Failed to load user data after token refresh:', userError)
							// Если не удалось загрузить пользователя, разлогиниваем
							logout()
							lastJwtRef.current = null
						}
					} else {
						console.warn('[AuthSessionRestorer] Refresh token response missing jwt')
						logout()
						lastJwtRef.current = null
					}
				} catch (error) {
					// Если refresh token невалиден или истек, разлогиниваем пользователя
					console.warn('[AuthSessionRestorer] Failed to restore session:', error)
					
					// Проверяем тип ошибки для более детального логирования
					if (error instanceof Error) {
						if (error.message.includes('401') || error.message.includes('Unauthorized')) {
							console.log('[AuthSessionRestorer] Refresh token expired or invalid')
							logout()
							lastJwtRef.current = null
						} else if (error.message.includes('Network') || error.message.includes('fetch')) {
							console.warn('[AuthSessionRestorer] Network error during session restore')
							// При сетевой ошибке не разлогиниваем сразу - возможно, это временная проблема
							// Просто не восстанавливаем сессию, но оставляем возможность повторить попытку
							isRestoring.current = false
							return
						} else {
							logout()
							lastJwtRef.current = null
						}
					} else {
						logout()
						lastJwtRef.current = null
					}
				} finally {
					isRestoring.current = false
				}
			}

			// Debounce для предотвращения множественных одновременных попыток
			if (jwtWasLost) {
				restoreTimeoutRef.current = setTimeout(() => {
					restoreSession()
				}, 100) // Небольшая задержка при потере JWT
			} else {
				// При первой загрузке восстанавливаем сразу
				restoreSession()
			}
		} else if (jwt) {
			// Сохраняем текущий JWT для отслеживания изменений
			lastJwtRef.current = jwt
			// Очищаем таймаут если JWT восстановился
			if (restoreTimeoutRef.current) {
				clearTimeout(restoreTimeoutRef.current)
				restoreTimeoutRef.current = null
			}
		}

		return () => {
			if (restoreTimeoutRef.current) {
				clearTimeout(restoreTimeoutRef.current)
			}
		}
	}, [isAuthenticated, jwt, setJwt, setUser, logout])

	// Этот компонент ничего не рендерит
	return null
}
