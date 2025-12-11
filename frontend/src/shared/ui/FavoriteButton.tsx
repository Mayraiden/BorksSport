'use client'

import { useState, useEffect, useRef } from 'react'
import { HeartStraightIcon } from '@phosphor-icons/react/ssr'
import { useAuthModal } from '@/shared/lib/contexts/AuthModalContext'
import { useAuthStore } from '@/features/Auth/model/store'
import { favoritesApi } from '@/features/Favorites/api/favoritesApi'
import { refreshFavoritesCount } from '@/features/Favorites/lib/useFavoritesCount'

type FavoriteButtonProps = {
	productId?: string
	className?: string
	checkOnMount?: boolean // Флаг для проверки статуса при загрузке (по умолчанию true - всегда проверяем)
	initialFavorite?: boolean // Начальное состояние избранного (например, для страницы избранного)
	onToggle?: () => void // Callback при изменении избранного (для обновления списка на странице избранного)
}

export const FavoriteButton = ({
	productId,
	className = '',
	checkOnMount = true, // По умолчанию проверяем при загрузке для правильного отображения состояния
	initialFavorite = false, // Начальное состояние избранного
	onToggle, // Callback при изменении избранного
}: FavoriteButtonProps) => {
	const [isFavorite, setIsFavorite] = useState(initialFavorite)
	const [isLoading, setIsLoading] = useState(false)
	const checkedProductIdRef = useRef<string | undefined>(undefined) // Отслеживаем для какого productId была проверка
	const { openModal } = useAuthModal()
	const { isAuthenticated, jwt } = useAuthStore()

	// Сбрасываем при смене productId
	useEffect(() => {
		if (productId && checkedProductIdRef.current !== productId) {
			setIsFavorite(initialFavorite)
			checkedProductIdRef.current = undefined
		}
	}, [productId, initialFavorite])

	// Check favorite status - запускается когда jwt становится доступным
	useEffect(() => {
		// Если передан initialFavorite, используем его и не делаем запрос
		if (initialFavorite) {
			setIsFavorite(true)
			checkedProductIdRef.current = productId
			return
		}

		// Если checkOnMount не включен или нет productId, не проверяем
		if (!checkOnMount || !productId) {
			// Не сбрасываем состояние, если checkOnMount выключен - оставляем текущее
			checkedProductIdRef.current = productId
			return
		}

		// Если пользователь не авторизован или нет JWT, не проверяем и не сбрасываем состояние
		// (ждем авторизации или загрузки store)
		if (!isAuthenticated || !jwt) {
			// Не сбрасываем состояние - оставляем текущее или initialFavorite
			return
		}

		// Если уже проверили для этого productId, не проверяем повторно
		if (checkedProductIdRef.current === productId) {
			return
		}

		let cancelled = false

		// Проверяем статус сразу при наличии jwt
		favoritesApi
			.checkFavorite(productId, jwt)
			.then((result) => {
				if (!cancelled) {
					setIsFavorite(result)
					checkedProductIdRef.current = productId
				}
			})
			.catch((err) => {
				if (!cancelled) {
					const errMsg = err?.message || ''
					console.warn('[FavoriteButton] Check failed:', {
						productId,
						errMsg,
						isAuthenticated,
						hasJwt: !!jwt,
					})
					// При ошибке проверки не сбрасываем состояние - оставляем текущее
					// Только помечаем, что проверка была выполнена
					checkedProductIdRef.current = productId
				}
			})

		return () => {
			cancelled = true
		}
	}, [productId, isAuthenticated, jwt, checkOnMount, initialFavorite])

	const handleToggleFavorite = async () => {
		if (!isAuthenticated) {
			openModal()
			return
		}

		if (!productId || !jwt) {
			return
		}

		setIsLoading(true)
		try {
			const newStatus = await favoritesApi.toggleFavorite(productId, jwt)
			setIsFavorite(newStatus)
			// Обновляем глобальный счетчик после изменения
			if (jwt) {
				refreshFavoritesCount(jwt)
			}
			// Вызываем callback для обновления списка на странице избранного
			if (onToggle) {
				onToggle()
			}
		} catch (error) {
			console.error('Failed to toggle favorite:', error)
			if (error instanceof Error && error.message === 'Unauthorized') {
				openModal()
			}
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<button
			onClick={handleToggleFavorite}
			disabled={isLoading || !productId}
			className={className}
			aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
		>
			<HeartStraightIcon
				size={24}
				weight={isFavorite ? 'fill' : 'regular'}
				className={`text-[#7B1931] ${isLoading ? 'opacity-50' : ''}`}
			/>
		</button>
	)
}
