'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuthStore } from '@/features/Auth/model/store'
import { cartApi } from '../api/cartApi'
import type { CartItemDisplay } from '../api/cartApi'

// Общие данные корзины для всех компонентов (singleton)
let globalCount = 0
let globalItems: CartItemDisplay[] = []
let globalLoading = false
const globalListeners = new Set<() => void>()
let hasLoaded = false // Флаг, что счетчик уже загружен
let globalJwt: string | null = null
let pendingForceReload = false

const notifyListeners = () => {
	globalListeners.forEach((listener) => listener())
}

const getCartItemByProductId = (productId?: string) => {
	if (!productId) return undefined
	return globalItems.find((item) => item.product.id === productId)
}

const resetCartState = () => {
	globalJwt = null
	hasLoaded = false // Сбрасываем флаг при выходе
	if (globalCount !== 0 || globalItems.length > 0) {
		globalCount = 0
		globalItems = []
		notifyListeners()
	}
}

const loadCart = async (jwt: string, force = false) => {
	// Если уже загружаем, не делаем параллельный запрос
	if (globalLoading) {
		if (force) {
			pendingForceReload = true
		}
		return
	}

	// Если уже загружено и не force, не обновляем (корзина меняется только при действиях пользователя)
	if (hasLoaded && !force) {
		return
	}

	globalLoading = true
	notifyListeners() // Уведомляем о начале загрузки
	try {
		const cartItems = await cartApi.getCart(jwt)
		globalItems = cartItems
		globalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)
		hasLoaded = true
		notifyListeners()
	} catch {
		globalCount = 0
		globalItems = []
		notifyListeners()
	} finally {
		globalLoading = false
		notifyListeners() // Уведомляем о завершении загрузки
		if (pendingForceReload && globalJwt) {
			pendingForceReload = false
			hasLoaded = false
			void loadCart(globalJwt, true)
		}
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
				loadCart(jwt)
			}
		} else {
			resetCartState()
		}

		return () => {
			if (listenerRef.current) {
				globalListeners.delete(listenerRef.current)
			}
		}
	}, [isAuthenticated, jwt])

	return { count, isLoading }
}

export const useCartItem = (productId?: string) => {
	const [cartItem, setCartItem] = useState<CartItemDisplay | undefined>(() =>
		getCartItemByProductId(productId)
	)
	const [isLoading, setIsLoading] = useState(globalLoading)
	const { isAuthenticated, jwt } = useAuthStore()
	const listenerRef = useRef<() => void | undefined>(undefined)

	useEffect(() => {
		listenerRef.current = () => {
			setCartItem(getCartItemByProductId(productId))
			setIsLoading(globalLoading)
		}
		globalListeners.add(listenerRef.current)
		listenerRef.current()

		if (isAuthenticated && jwt) {
			const jwtChanged = globalJwt !== jwt
			globalJwt = jwt
			if (!hasLoaded || jwtChanged) {
				loadCart(jwt)
			}
		} else {
			resetCartState()
		}

		return () => {
			if (listenerRef.current) {
				globalListeners.delete(listenerRef.current)
			}
		}
	}, [isAuthenticated, jwt, productId])

	return { cartItem, isLoading }
}

// Функция для ручного обновления счетчика (вызывается после добавления/удаления из корзины)
export const refreshCartCount = async (jwt: string) => {
	globalJwt = jwt
	hasLoaded = false // Сбрасываем флаг, чтобы принудительно обновить
	await loadCart(jwt, true) // Force обновление
}
