import type { Product } from '@/shared/types'

const API_URL = 'http://localhost:1337'

interface ApiProduct {
	id: number
	name?: string
	article?: string | null
	sbisNomNumber?: string
	categoryName?: string
	price?: number
	description?: string
	images?: (string | null)[]
}

interface FavoriteResponse {
	success: boolean
	data?: FavoriteItem[]
	message?: string
	error?: string
}

interface FavoriteCheckResponse {
	success: boolean
	data?: {
		isFavorite: boolean
		favoriteId?: number | null
	}
	message?: string
	error?: string
}

interface FavoriteItem {
	id: number
	product: Product
	createdAt: string
}

export const favoritesApi = {
	/**
	 * Get user's favorite products
	 */
	async getFavorites(token: string): Promise<Product[]> {
		try {
			const response = await fetch(`${API_URL}/api/favorites`, {
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
				if (response.status === 403) {
					throw new Error(
						'Forbidden: Check Strapi permissions for Favorite API'
					)
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: FavoriteResponse = await response.json()

			if (!data.success || !data.data) {
				throw new Error(
					data.message || data.error || 'Failed to fetch favorites'
				)
			}

			// Transform favorite items to products (using same image transformation as productApi)
			return data.data.map((item: FavoriteItem) => {
				const apiProduct = item.product as unknown as ApiProduct
				// Transform images using the same logic as productApi
				const transformImages = () => {
					const validImages = (apiProduct.images || [])
						.filter((imgUrl): imgUrl is string => imgUrl !== null && typeof imgUrl === 'string')
						.map((imgUrl: string, index: number) => {
							try {
								const paramsMatch = imgUrl.match(/params=(.+)/)
								if (paramsMatch) {
									const rawParams = paramsMatch[1]
									try {
										const decodedParams = atob(rawParams)
										const params = JSON.parse(decodedParams)
										if (params.PhotoURL) {
											return {
												id: index.toString(),
												url: params.PhotoURL,
												alt: apiProduct.name || 'Изображение товара',
											}
										}
									} catch {
										try {
											const decodedParams = decodeURIComponent(rawParams)
											const params = JSON.parse(decodedParams)
											if (params.PhotoURL) {
												return {
													id: index.toString(),
													url: params.PhotoURL,
													alt: apiProduct.name || 'Изображение товара',
												}
											}
										} catch {}
									}
								}
							} catch {}
							return {
								id: index.toString(),
								url: '/NoProductImage.jpg',
								alt: apiProduct.name || 'Изображение товара',
							}
						})
					return validImages.length > 0
						? validImages
						: [
								{
									id: '0',
									url: '/NoProductImage.jpg',
									alt: apiProduct.name || 'Изображение товара',
								},
							]
				}

				return {
					id: apiProduct.id.toString(),
					name: apiProduct.name || 'Без названия',
					article:
						apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
					brand: apiProduct.categoryName || 'Не указано',
					price: apiProduct.price || 0,
					images: transformImages(),
					colors: [],
					sizes: [],
					description: apiProduct.description,
					characteristics: {
						Категория: apiProduct.categoryName || 'Не указано',
						Артикул:
							apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
					},
				}
			})
		} catch (error) {
			// Don't log 403 errors loudly - they're permission issues
			const err = error as Error
			if (
				!err.message?.includes('403') &&
				!err.message?.includes('Forbidden')
			) {
				console.error('Error fetching favorites:', error)
			}
			throw error
		}
	},

	/**
	 * Check if product is in favorites
	 */
		async checkFavorite(productId: string, token: string): Promise<boolean> {
			try {
				const response = await fetch(
					`${API_URL}/api/favorites/check/${productId}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
							'Content-Type': 'application/json',
						},
					}
				)

				if (!response.ok) {
					if (response.status === 401 || response.status === 403) {
						return false // Not authenticated or forbidden means not favorite
					}
					throw new Error(`API error: ${response.status}`)
				}

				const data: FavoriteCheckResponse = await response.json()

				return data.success && data.data?.isFavorite === true
			} catch {
				// Silently return false for auth errors
				return false
			}
		},

	/**
	 * Toggle favorite status (add if not exists, remove if exists)
	 */
		async toggleFavorite(productId: string, token: string): Promise<boolean> {
			try {
				const response = await fetch(`${API_URL}/api/favorites/toggle`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ productId }),
				})

				if (!response.ok) {
					if (response.status === 401) {
						throw new Error('Unauthorized')
					}
					throw new Error(`API error: ${response.status}`)
				}

				const data: FavoriteCheckResponse = await response.json()

				if (!data.success) {
					throw new Error(
						data.message || data.error || 'Failed to toggle favorite'
					)
				}

				return data.data?.isFavorite === true
			} catch (error) {
				console.error('Error toggling favorite:', error)
				throw error
			}
		},

	/**
	 * Add product to favorites
	 */
	async addFavorite(productId: string, token: string): Promise<void> {
		try {
			const response = await fetch(`${API_URL}/api/favorites`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ productId }),
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: FavoriteResponse = await response.json()

			if (!data.success) {
				throw new Error(data.message || data.error || 'Failed to add favorite')
			}
		} catch (error) {
			console.error('Error adding favorite:', error)
			throw error
		}
	},

	/**
	 * Get count of user's favorites
	 */
	async getFavoritesCount(token: string): Promise<number> {
		try {
			const favorites = await this.getFavorites(token)
			return favorites.length
		} catch {
			return 0
		}
	},

	/**
	 * Remove product from favorites
	 */
	async removeFavorite(favoriteId: number, token: string): Promise<void> {
		try {
			const response = await fetch(`${API_URL}/api/favorites/${favoriteId}`, {
				method: 'DELETE',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: FavoriteResponse = await response.json()

			if (!data.success) {
				throw new Error(
					data.message || data.error || 'Failed to remove favorite'
				)
			}
		} catch (error) {
			console.error('Error removing favorite:', error)
			throw error
		}
	},
}
