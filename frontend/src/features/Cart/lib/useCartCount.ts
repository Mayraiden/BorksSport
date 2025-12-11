'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/features/Auth/model/store'
import { cartApi } from '../api/cartApi'

// Общий счетчик для всех компонентов (singleton)
let globalCount = 0
let globalLoading = false
const globalListeners = new Set<() => void>()
let hasLoaded = false // Флаг, что счетчик уже загружен
let globalJwt: string | null = null

const notifyListeners = () => {
	globalListeners.forEach((listener) => listener())
}

const loadCount = async (jwt: string, force = false) => {
	// Если уже загружаем, не делаем параллельный запрос
	if (globalLoading) return

	// Если уже загружено и не force, не обновляем (счетчик меняется только при действиях пользователя)
	if (hasLoaded && !force) {
		return
	}

	globalLoading = true
	notifyListeners() // Уведомляем о начале загрузки
	try {
		const cartCount = await cartApi.getCartCount(jwt)
		globalCount = cartCount
		hasLoaded = true
		notifyListeners()
	} catch {
		globalCount = 0
		notifyListeners()
	} finally {
		globalLoading = false
		notifyListeners() // Уведомляем о завершении загрузки
	}
}

export const useCartCount = () => {
	const [count, setCount] = useState(globalCount)
	const [isLoading, setIsLoading] = useState(globalLoading)
	const { isAuthenticated, jwt } = useAuthStore()
	const listenerRef = useRef<() => void | undefined>(undefined)

	useEffect(() => {
		// Создаем listener для обновления состояния
		listenerRef.current = () => {
			setCount(globalCount)
			setIsLoading(globalLoading)
		}
		globalListeners.add(listenerRef.current)

		// Если авторизован, загружаем счетчик один раз при монтировании
		if (isAuthenticated && jwt) {
			const jwtChanged = globalJwt !== jwt
			globalJwt = jwt
			// Загружаем только если еще не загружали или jwt изменился
			if (!hasLoaded || jwtChanged) {
				loadCount(jwt)
			}
		} else {
			globalJwt = null
			hasLoaded = false // Сбрасываем флаг при выходе
			if (globalCount !== 0) {
				globalCount = 0
				notifyListeners()
			}
		}

		return () => {
			if (listenerRef.current) {
				globalListeners.delete(listenerRef.current)
			}
		}
	}, [isAuthenticated, jwt])

	return { count, isLoading }
}

// Функция для ручного обновления счетчика (вызывается после добавления/удаления из корзины)
export const refreshCartCount = async (jwt: string) => {
	globalJwt = jwt
	hasLoaded = false // Сбрасываем флаг, чтобы принудительно обновить
	await loadCount(jwt, true) // Force обновление
}
