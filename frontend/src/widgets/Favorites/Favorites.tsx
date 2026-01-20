'use client'

import { useEffect, useState } from 'react'
import { ItemCard } from '@/shared/ui/ItemCard'
import { ProfileDropdown } from '@/shared/ui/ProfileDropdown'
import { useAuthStore } from '@/features/Auth/model/store'
import { useJwtWithRestore } from '@/features/Auth/lib/useJwtWithRestore'
import { favoritesApi } from '@/features/Favorites/api/favoritesApi'
import type { Product } from '@/shared/types'

export const Favorites = () => {
	const [products, setProducts] = useState<Product[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const { isAuthenticated } = useAuthStore()
	const { jwt } = useJwtWithRestore()

	// Функция для обновления списка избранного после удаления
	const refreshFavorites = async () => {
		if (!jwt) return
		try {
			const favorites = await favoritesApi.getFavorites(jwt)
			setProducts(favorites)
		} catch (err) {
			console.error('Failed to refresh favorites:', err)
		}
	}

	useEffect(() => {
		const loadFavorites = async () => {
			// Если пользователь не авторизован или нет jwt, не загружаем избранное
			if (!isAuthenticated || !jwt) {
				setIsLoading(false)
				return
			}

			try {
				setIsLoading(true)
				setError(null)
				const favorites = await favoritesApi.getFavorites(jwt)
				setProducts(favorites)
			} catch (err: unknown) {
				const errMsg = err instanceof Error ? err.message : String(err)
				// Handle 403 as permission issue - show user-friendly message
				if (errMsg.includes('403') || errMsg.includes('Forbidden')) {
					setError('Нет доступа к избранному. Обратитесь к администратору.')
					console.warn('[Favorites] Permission denied - check Strapi settings')
				} else if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
					setError('Необходимо войти в аккаунт')
				} else {
					console.error('Failed to load favorites:', err)
					setError(errMsg || 'Не удалось загрузить избранное')
				}
				setProducts([])
			} finally {
				setIsLoading(false)
			}
		}

		loadFavorites()
	}, [isAuthenticated, jwt])

	if (!isAuthenticated) {
		return (
			<section className="flex flex-col gap-5 max-sm:gap-3">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-black max-sm:text-xl">
						Избранное
					</h1>
					<ProfileDropdown />
				</div>
				<p className="text-gray max-sm:text-sm">
					Войдите в аккаунт, чтобы видеть избранные товары
				</p>
			</section>
		)
	}

	if (isLoading) {
		return (
			<section className="flex flex-col gap-5 max-sm:gap-3">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-black max-sm:text-xl">
						Избранное
					</h1>
					<ProfileDropdown />
				</div>
				<p className="text-gray max-sm:text-sm">Загрузка...</p>
			</section>
		)
	}

	if (error) {
		return (
			<section className="flex flex-col gap-5 max-sm:gap-3">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-black max-sm:text-xl">
						Избранное
					</h1>
					<ProfileDropdown />
				</div>
				<p className="text-red-500 max-sm:text-sm">{error}</p>
			</section>
		)
	}

	if (products.length === 0) {
		return (
			<section className="flex flex-col gap-5 max-sm:gap-3">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-black max-sm:text-xl">
						Избранное
					</h1>
					<ProfileDropdown />
				</div>
				<p className="text-gray max-sm:text-sm">
					У вас пока нет избранных товаров
				</p>
			</section>
		)
	}

	return (
		<section className="flex flex-col gap-5 max-sm:gap-3">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-black max-sm:text-xl">
					Избранное ({products.length})
				</h1>
				<ProfileDropdown />
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-sm:gap-3 md:gap-4 min-w-0">
				{products.map((product) => (
					<ItemCard
						key={product.id}
						product={product}
						isFavorite={true}
						onFavoriteToggle={refreshFavorites}
					/>
				))}
			</div>
		</section>
	)
}
