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

interface CartResponse {
	success: boolean
	data?: CartItem[] | CartItem
	message?: string
	error?: string
}

export interface CartItem {
	id: number
	product: Product & {
		id: number
		images: string[]
		article?: string | null
		sbisNomNumber?: string
		categoryName?: string
	}
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
const transformApiProduct = (apiProduct: ApiProduct): Product => {
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
		article: apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
		name: apiProduct.name || 'Без названия',
		brand: apiProduct.categoryName || 'Не указано',
		price: apiProduct.price || 0,
		images: transformImages(),
		colors: [],
		sizes: [],
		description: apiProduct.description,
		characteristics: {
			Категория: apiProduct.categoryName || 'Не указано',
			Артикул: apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
		},
	}
}

export const cartApi = {
	/**
	 * Get user's cart items
	 */
	async getCart(token: string): Promise<CartItemDisplay[]> {
		try {
			const response = await fetch(`${API_URL}/api/cart-items`, {
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
			const response = await fetch(`${API_URL}/api/cart-items`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
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
			const response = await fetch(`${API_URL}/api/cart-items/${cartItemId}`, {
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ quantity }),
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
			const response = await fetch(`${API_URL}/api/cart-items/${cartItemId}`, {
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
			const response = await fetch(`${API_URL}/api/cart-items`, {
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
