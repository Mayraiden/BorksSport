import type { Product, ApiProduct } from '@/shared/types'
import { fetchWithAuth } from '@/shared/lib/apiClient'

interface CartResponse {
	success: boolean
	data?: CartItem[] | CartItem
	message?: string
	error?: string
	code?: string
	available?: number
}

export interface CartItem {
	id: number
	product: ApiProduct
	quantity: number
	createdAt: string
	updatedAt: string
}

export interface CartItemDisplay {
	id: number
	cartItemId: number
	product: Product
	quantity: number
}

// Transform API product to our Product type (same as in productApi)
// Используем упрощенную версию для корзины, так как варианты там не нужны
const transformApiProduct = (apiProduct: ApiProduct): Product => {
	const availableStock =
		apiProduct.availableStock !== null && apiProduct.availableStock !== undefined
			? apiProduct.availableStock
			: apiProduct.stock !== null && apiProduct.stock !== undefined
				? Math.max(
						0,
						Math.floor(Number(apiProduct.stock ?? 0)) -
							Math.floor(Number(apiProduct.reservedStock ?? 0)) -
							Math.floor(Number(apiProduct.soldButNotSynced ?? 0))
				  )
				: null

	// Изображения уже обработаны на бэкенде, фильтруем null значения
	const images = (apiProduct.images || [])
		.filter((url): url is string => url !== null && url !== undefined)
		.map((url, index) => ({
			id: index.toString(),
			url: url,
			alt: apiProduct.name || 'Изображение товара',
		}))

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
		article: apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
		name: apiProduct.name || 'Без названия',
		brand: apiProduct.categoryName || 'Не указано',
		price: apiProduct.price || 0,
		images: validImages,
		colors: [], // Для корзины варианты не нужны
		sizes: [], // Для корзины варианты не нужны
		description: apiProduct.description,
		characteristics: {
			Категория: apiProduct.categoryName || 'Не указано',
			Артикул: apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
			Единица: apiProduct.unit || 'шт',
		},
		size: apiProduct.size || null,
		color: apiProduct.color || null,
		weight: apiProduct.weight ?? null,
		length: apiProduct.length ?? null,
		width: apiProduct.width ?? null,
		height: apiProduct.height ?? null,
		stock: apiProduct.stock ?? null,
		availableStock,
	}
}

export const cartApi = {
	/**
	 * Get user's cart items
	 */
	async getCart(token: string): Promise<CartItemDisplay[]> {
		try {
			const response = await fetchWithAuth('/api/cart-items', {
				method: 'GET',
				accessToken: token,
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
				if (response.status === 403) {
					throw new Error('Forbidden: Check Strapi permissions for Cart API')
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: CartResponse = await response.json()

			if (!data.success || !data.data) {
				throw new Error(data.message || data.error || 'Failed to fetch cart')
			}

			// Transform cart items
			const items = Array.isArray(data.data) ? data.data : [data.data]
			return items
				.filter((item: CartItem) => item.product !== null && item.product !== undefined)
				.map((item: CartItem) => ({
					id: item.id,
					cartItemId: item.id,
					product: transformApiProduct(item.product),
					quantity: item.quantity,
				}))
		} catch (error) {
			const err = error as Error
			if (
				!err.message?.includes('403') &&
				!err.message?.includes('Forbidden')
			) {
				console.error('Error fetching cart:', error)
			}
			throw error
		}
	},

	/**
	 * Add product to cart
	 */
	async addToCart(
		productId: string,
		quantity: number = 1,
		token: string
	): Promise<CartItemDisplay> {
		try {
			const response = await fetchWithAuth('/api/cart-items', {
				method: 'POST',
				accessToken: token,
				body: JSON.stringify({ productId, quantity }),
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: CartResponse = await response.json()

			if (!data.success || !data.data) {
				throw new Error(data.message || data.error || 'Failed to add to cart')
			}

			const item = Array.isArray(data.data) ? data.data[0] : data.data
			if (!item.product) {
				throw new Error('Product data is missing in cart item')
			}
			return {
				id: item.id,
				cartItemId: item.id,
				product: transformApiProduct(item.product),
				quantity: item.quantity,
			}
		} catch (error) {
			console.error('Error adding to cart:', error)
			throw error
		}
	},

	/**
	 * Update cart item quantity
	 */
	async updateQuantity(
		cartItemId: number,
		quantity: number,
		token: string
	): Promise<CartItemDisplay> {
		try {
			const response = await fetchWithAuth(`/api/cart-items/${cartItemId}`, {
				method: 'PUT',
				accessToken: token,
				body: JSON.stringify({ quantity }),
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
				if (response.status === 404) {
					throw new Error('Cart item not found')
				}
				if (response.status === 409) {
					// Try to read backend payload for a user-friendly message.
					try {
						const payload = (await response.json()) as CartResponse
						const available = typeof payload.available === 'number' ? payload.available : undefined
						const message =
							payload.message ||
							(available !== undefined ? `Доступно ${available} шт.` : 'Недостаточно товара')
						const err = new Error(message)
						;(err as unknown as { code?: string }).code = payload.code || 'INSUFFICIENT_STOCK'
						;(err as unknown as { available?: number }).available = available
						throw err
					} catch {
						throw new Error('Недостаточно товара')
					}
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: CartResponse = await response.json()

			if (!data.success || !data.data) {
				throw new Error(
					data.message || data.error || 'Failed to update cart item'
				)
			}

			const item = Array.isArray(data.data) ? data.data[0] : data.data
			if (!item.product) {
				throw new Error('Product data is missing in cart item')
			}
			return {
				id: item.id,
				cartItemId: item.id,
				product: transformApiProduct(item.product),
				quantity: item.quantity,
			}
		} catch (error) {
			console.error('Error updating cart item:', error)
			throw error
		}
	},

	/**
	 * Remove item from cart
	 */
	async removeFromCart(cartItemId: number, token: string): Promise<void> {
		try {
			const response = await fetchWithAuth(`/api/cart-items/${cartItemId}`, {
				method: 'DELETE',
				accessToken: token,
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
				if (response.status === 404) {
					throw new Error('Cart item not found')
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: CartResponse = await response.json()

			if (!data.success) {
				throw new Error(
					data.message || data.error || 'Failed to remove from cart'
				)
			}
		} catch (error) {
			console.error('Error removing from cart:', error)
			throw error
		}
	},

	/**
	 * Clear cart
	 */
	async clearCart(token: string): Promise<void> {
		try {
			const response = await fetchWithAuth('/api/cart-items', {
				method: 'DELETE',
				accessToken: token,
			})

			if (!response.ok) {
				if (response.status === 401) {
					throw new Error('Unauthorized')
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: CartResponse = await response.json()

			if (!data.success) {
				throw new Error(data.message || data.error || 'Failed to clear cart')
			}
		} catch (error) {
			console.error('Error clearing cart:', error)
			throw error
		}
	},

	/**
	 * Get count of items in cart
	 */
	async getCartCount(token: string): Promise<number> {
		try {
			const cart = await this.getCart(token)
			return cart.reduce((sum, item) => sum + item.quantity, 0)
		} catch {
			return 0
		}
	},
}
