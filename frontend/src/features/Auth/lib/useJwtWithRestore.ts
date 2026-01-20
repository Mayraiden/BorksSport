'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '../model/store'
import { strapiAuth } from '../model/api'

/**
 * Хук для безопасного получения JWT токена с автоматическим восстановлением сессии
 * 
 * Если пользователь авторизован (isAuthenticated=true), но JWT отсутствует,
 * автоматически пытается восстановить его через refresh token.
 * 
 * @returns { jwt: string | null, isRestoring: boolean }
 */
export const useJwtWithRestore = () => {
	const { isAuthenticated, jwt } = useAuthStore()
	const [isRestoring, setIsRestoring] = useState(false)
	const isRestoringRef = useRef(false)
	const hasTriedRestoreRef = useRef(false)

	useEffect(() => {
		// Если пользователь авторизован, но JWT отсутствует - пытаемся восстановить
		if (isAuthenticated && !jwt && !isRestoringRef.current) {
			// Если уже пытались восстановить недавно, пропускаем (защита от бесконечных циклов)
			// Но если JWT был восстановлен и снова потерян, разрешаем повторную попытку
			if (hasTriedRestoreRef.current) {
				// Даем небольшую задержку перед повторной попыткой
				const timeout = setTimeout(() => {
					hasTriedRestoreRef.current = false
				}, 2000)
				return () => clearTimeout(timeout)
			}

			const restoreSession = async () => {
				if (isRestoringRef.current) return
				
				try {
					isRestoringRef.current = true
					setIsRestoring(true)
					hasTriedRestoreRef.current = true
					
					if (process.env.NODE_ENV === 'development') {
						console.log('[useJwtWithRestore] Attempting to restore session...')
					}
					
					// Пытаемся обновить токен через refresh token из cookie
					const refreshResult = await strapiAuth.refreshToken()
					
					if (refreshResult?.jwt) {
						// Успешно восстановили токен
						useAuthStore.getState().setJwt(refreshResult.jwt)
						
						if (process.env.NODE_ENV === 'development') {
							console.log('[useJwtWithRestore] Token refreshed successfully')
						}
						
						// Загружаем данные пользователя для обновления store
						try {
							const user = await strapiAuth.getMe(refreshResult.jwt)
							useAuthStore.getState().setUser(user)
						} catch (userError) {
							console.error('[useJwtWithRestore] Failed to load user data after token refresh:', userError)
							// Если не удалось загрузить пользователя, разлогиниваем
							useAuthStore.getState().logout()
						}
					} else {
						console.warn('[useJwtWithRestore] Refresh token response missing jwt')
						useAuthStore.getState().logout()
					}
				} catch (error) {
					// Если refresh token невалиден или истек
					console.warn('[useJwtWithRestore] Failed to restore session:', error)
					
					if (error instanceof Error) {
						if (error.message.includes('401') || error.message.includes('Unauthorized')) {
							console.log('[useJwtWithRestore] Refresh token expired or invalid')
							useAuthStore.getState().logout()
						} else if (error.message.includes('Network') || error.message.includes('fetch')) {
							console.warn('[useJwtWithRestore] Network error during session restore')
							// При сетевой ошибке не разлогиниваем - возможно, это временная проблема
							// Сбрасываем флаг через некоторое время для повторной попытки
							setTimeout(() => {
								hasTriedRestoreRef.current = false
							}, 3000)
						} else {
							useAuthStore.getState().logout()
						}
					} else {
						useAuthStore.getState().logout()
					}
				} finally {
					isRestoringRef.current = false
					setIsRestoring(false)
				}
			}

			restoreSession()
		} else if (jwt) {
			// Если JWT восстановился, сбрасываем флаг для возможности повторного восстановления в будущем
			hasTriedRestoreRef.current = false
		}
	}, [isAuthenticated, jwt])

	return { jwt, isRestoring }
}
