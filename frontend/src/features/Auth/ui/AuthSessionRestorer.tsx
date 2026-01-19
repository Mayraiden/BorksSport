'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '../model/store'
import { strapiAuth } from '../model/api'

/**
 * Компонент для восстановления сессии при загрузке приложения
 * Если пользователь был авторизован (isAuthenticated=true из localStorage),
 * но JWT токен отсутствует (потерян при перезагрузке страницы),
 * пытается восстановить его через refresh token из HTTP-only cookie
 */
export const AuthSessionRestorer = () => {
	const { isAuthenticated, jwt, setJwt, setUser, logout } = useAuthStore()
	const hasTriedRestore = useRef(false)
	const isRestoring = useRef(false)

	useEffect(() => {
		// Пропускаем, если уже пытались восстановить или идет процесс восстановления
		if (hasTriedRestore.current || isRestoring.current) return

		// Если пользователь авторизован, но JWT отсутствует - пытаемся восстановить
		if (isAuthenticated && !jwt) {
			const restoreSession = async () => {
				if (isRestoring.current) return
				
				try {
					isRestoring.current = true
					hasTriedRestore.current = true
					
					if (process.env.NODE_ENV === 'development') {
						console.log('[AuthSessionRestorer] Attempting to restore session...')
					}
					
					// Пытаемся обновить токен через refresh token из cookie
					const refreshResult = await strapiAuth.refreshToken()
					
					if (refreshResult?.jwt) {
						// Успешно восстановили токен
						setJwt(refreshResult.jwt)
						
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
						}
					} else {
						console.warn('[AuthSessionRestorer] Refresh token response missing jwt')
						logout()
					}
				} catch (error) {
					// Если refresh token невалиден или истек, разлогиниваем пользователя
					console.warn('[AuthSessionRestorer] Failed to restore session:', error)
					
					// Проверяем тип ошибки для более детального логирования
					if (error instanceof Error) {
						if (error.message.includes('401') || error.message.includes('Unauthorized')) {
							console.log('[AuthSessionRestorer] Refresh token expired or invalid')
						} else if (error.message.includes('Network') || error.message.includes('fetch')) {
							console.warn('[AuthSessionRestorer] Network error during session restore')
							// При сетевой ошибке не разлогиниваем сразу - возможно, это временная проблема
							// Просто не восстанавливаем сессию
							isRestoring.current = false
							return
						}
					}
					
					logout()
				} finally {
					isRestoring.current = false
				}
			}

			restoreSession()
		} else {
			hasTriedRestore.current = true
		}
	}, [isAuthenticated, jwt, setJwt, setUser, logout])

	// Этот компонент ничего не рендерит
	return null
}
