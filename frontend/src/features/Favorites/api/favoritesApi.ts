import type { Product } from '@/shared/types'
import { fetchWithAuth } from '@/shared/lib/apiClient'

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

/**
 * Извлекает PhotoURL из строки /img?params=... (на случай, если на бэкенде не была обработана)
 * Работает только в браузере (использует atob)
 * Используется та же логика, что и в productApi.ts
 */
function extractPhotoURLFromParams(url: string): string | null {
	if (!url || typeof url !== 'string') {
		return null
	}

	// Если это уже полный URL, возвращаем его
	if (url.startsWith('http://') || url.startsWith('https://')) {
		return url
	}

	// Если это относительный путь /img?params=..., пытаемся извлечь PhotoURL
	if (url.startsWith('/img?params=')) {
		// Проверяем, что мы в браузере (atob доступен только в браузере)
		if (typeof window === 'undefined' || typeof atob === 'undefined') {
			return null
		}

		try {
			const paramsMatch = url.match(/params=(.+)/)
			if (paramsMatch) {
				const rawParams = paramsMatch[1]
				
				// Пробуем base64 декодирование
				try {
					const decodedParams = atob(rawParams)
					const params = JSON.parse(decodedParams)
					if (params.PhotoURL) {
						return params.PhotoURL
					}
				} catch {
					// Пробуем URL декодирование
					try {
						const decodedParams = decodeURIComponent(rawParams)
						const params = JSON.parse(decodedParams)
						if (params.PhotoURL) {
							return params.PhotoURL
						}
					} catch {
						// Не удалось декодировать
						return null
					}
				}
			}
		} catch {
			return null
		}
	}

	return null
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
			const response = await fetchWithAuth('/api/favorites', {
				method: 'GET',
				accessToken: token,
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
			// Фильтруем элементы с null product (если продукт был удален из базы)
			const validItems = data.data.filter((item: FavoriteItem) => {
				const hasProduct = item.product !== null && item.product !== undefined
				if (!hasProduct && process.env.NODE_ENV === 'development') {
					console.warn(`[favoritesApi] Favorite item ${item.id} has null product, filtering out`)
				}
				return hasProduct
			})

			return validItems.map((item: FavoriteItem) => {
				const apiProduct = item.product as unknown as ApiProduct
				// Transform images using the same logic as productApi
				const images = (apiProduct.images || [])
					.filter((url): url is string => url !== null && typeof url === 'string')
					.map((url) => {
						// Если URL не полный (начинается с /img?params=), пытаемся извлечь PhotoURL
						const processedUrl = extractPhotoURLFromParams(url) || url
						return processedUrl
					})
					.filter((url): url is string => {
						// Фильтруем невалидные URL (null, пустые строки, относительные пути без params)
						if (!url || typeof url !== 'string') {
							return false
						}
						// Если это относительный путь /img?params= и не удалось извлечь PhotoURL, пропускаем
						if (url.startsWith('/img?params=')) {
							return false
						}
						return true
					})
					.map((url, index) => ({
						id: index.toString(),
						url: url,
						alt: apiProduct.name || 'Изображение товара',
					}))

				// Если нет изображений, добавляем fallback
				const validImages =
					images.length > 0
						? images
						: [
								{
									id: '0',
									url: '/NoProductImage.jpg',
									alt: apiProduct.name || 'Изображение товара',
								},
							]

				return {
					id: apiProduct.id.toString(),
					name: apiProduct.name || 'Без названия',
					article:
						apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
					brand: apiProduct.categoryName || 'Не указано',
					price: apiProduct.price || 0,
					images: validImages,
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
				const response = await fetchWithAuth(`/api/favorites/check/${productId}`, {
					method: 'GET',
					accessToken: token,
				})

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
				const response = await fetchWithAuth('/api/favorites/toggle', {
					method: 'POST',
					accessToken: token,
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
			const response = await fetchWithAuth('/api/favorites', {
				method: 'POST',
				accessToken: token,
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
			const response = await fetchWithAuth(`/api/favorites/${favoriteId}`, {
				method: 'DELETE',
				accessToken: token,
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
