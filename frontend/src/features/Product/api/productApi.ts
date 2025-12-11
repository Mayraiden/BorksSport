import type {
	ApiProduct,
	ApiResponse,
	ApiErrorResponse,
	ProductFilters,
	PaginationParams,
	Product,
	SearchSuggestion,
} from '@/shared/types'

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_STRAPI_URL || 'http://localhost:1337'

// Transform API product to our Product type
const transformApiProduct = (apiProduct: ApiProduct): Product => {
	return {
		id: apiProduct.id.toString(),
		article: apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
		name: apiProduct.name || 'Без названия',
		brand: apiProduct.categoryName || 'Не указано',
		price: apiProduct.price || 0,
		images: (() => {
			// Extract SBIS photo URLs from the params
			const validImages = (apiProduct.images || [])
				.filter((imgUrl) => imgUrl && typeof imgUrl === 'string')
				.map((imgUrl, index) => {
					try {
						// Extract SBIS photo URL from the params
						const paramsMatch = imgUrl.match(/params=(.+)/)
						if (paramsMatch) {
							const rawParams = paramsMatch[1]

							// Try base64 decoding
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
								// Try URL decoding
								const decodedParams = decodeURIComponent(rawParams)
								const params = JSON.parse(decodedParams)

								if (params.PhotoURL) {
									return {
										id: index.toString(),
										url: params.PhotoURL,
										alt: apiProduct.name || 'Изображение товара',
									}
								}
							}
						}
					} catch (error) {
						console.warn('Failed to parse image params:', error)
					}

					// Fallback to default image
					return {
						id: index.toString(),
						url: '/NoProductImage.jpg',
						alt: apiProduct.name || 'Изображение товара',
					}
				})

			// If no valid images, add a fallback
			if (validImages.length === 0) {
				return [
					{
						id: '0',
						url: '/NoProductImage.jpg', // Fallback image
						alt: apiProduct.name || 'Изображение товара',
					},
				]
			}

			return validImages
		})(),
		colors: [], // Not available in current API
		sizes: [], // Not available in current API
		description: apiProduct.description,
		characteristics: {
			Категория: apiProduct.categoryName || 'Не указано',
			Артикул: apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
			Единица: apiProduct.unit || 'шт',
			'SBIS ID': apiProduct.sbisId?.toString() || 'Не указано',
		},
	}
}

// Main API functions
export const productApi = {
	async getProducts(params: ProductFilters & PaginationParams = {}): Promise<{
		products: Product[]
		total: number
		page: number
		pageSize: number
		pageCount: number
	}> {
		const searchParams = new URLSearchParams()

		// Pagination - convert to API format
		const start = params.start ?? params.offset ?? 0
		const limit = params.limit ?? params.pageSize ?? 20

		searchParams.append('start', start.toString())
		searchParams.append('limit', limit.toString())

		// Sorting
		if (params.sortBy) {
			const sortField =
				params.sortBy === 'createdAt' ? 'createdAt' : params.sortBy
			const sortOrder = params.sortOrder || 'asc'
			searchParams.append('sort', `${sortField}:${sortOrder}`)
		}

		// Filters
		if (params.search) {
			// Temporarily use Strapi search until Meilisearch is fixed
			console.log(`🔍 [Search] Using Strapi search for: "${params.search}"`)
			searchParams.append('filters[$or][0][name][$containsi]', params.search)
			searchParams.append(
				'filters[$or][1][description][$containsi]',
				params.search
			)
			searchParams.append(
				'filters[$or][2][sbisNomNumber][$containsi]',
				params.search
			)
			searchParams.append(
				'filters[$or][3][categoryName][$containsi]',
				params.search
			)
		}

		// Category filter (level 1 - product categories like "Сумки", "Мячи")
		// Используем связь category для фильтрации по имени категории
		if (params.category) {
			console.log('🔍 [Filter] Category filter:', params.category)
			// Если category содержит запятую, это множественные значения
			if (params.category.includes(',')) {
				const categories = params.category.split(',').filter(Boolean)
				categories.forEach((category, index) => {
					searchParams.append(
						`filters[$or][${index}][category][name][$eq]`,
						category.trim()
					)
				})
			} else {
				// Одна категория
				const categoryValue = params.category.trim()
				console.log('🔍 [Filter] Filtering by category name:', categoryValue)
				searchParams.append('filters[category][name][$eq]', categoryValue)
			}
		}

		// Brand filter (level 2 - brands like "Easton", "Rawlings")
		// Используем связь category для фильтрации по имени бренда
		if (params.brand) {
			console.log('🔍 [Filter] Brand filter:', params.brand)
			// Если brand содержит запятую, это множественные значения
			if (params.brand.includes(',')) {
				const brands = params.brand.split(',').filter(Boolean)
				brands.forEach((brand, index) => {
					searchParams.append(
						`filters[$or][${index}][category][name][$eq]`,
						brand.trim()
					)
				})
			} else {
				// Один бренд
				const brandValue = params.brand.trim()
				console.log('🔍 [Filter] Filtering by brand name:', brandValue)
				searchParams.append('filters[category][name][$eq]', brandValue)
			}
		}

		// Sport type filter (level 0 - main categories like "Бейсбол и Софтбол")
		// Используем rootCategoryName для фильтрации по главным категориям
		if (params.sport) {
			console.log('🔍 [Filter] Sport type filter:', params.sport)
			// Если sport содержит запятую, это множественные значения
			if (params.sport.includes(',')) {
				const sports = params.sport.split(',').filter(Boolean)
				sports.forEach((sport, index) => {
					searchParams.append(
						`filters[$or][${index}][rootCategoryName][$eq]`,
						sport.trim()
					)
				})
			} else {
				// Один вид спорта
				const sportValue = params.sport.trim()
				console.log('🔍 [Filter] Filtering by rootCategoryName:', sportValue)
				searchParams.append('filters[rootCategoryName][$eq]', sportValue)
			}
		}

		// Price range
		if (params.minPrice !== undefined) {
			searchParams.append('filters[price][$gte]', params.minPrice.toString())
		}

		if (params.maxPrice !== undefined) {
			searchParams.append('filters[price][$lte]', params.maxPrice.toString())
		}

		try {
			const url = `${API_URL}/api/products?${searchParams}`

			// Log URL for debugging
			if (params.search || params.category || params.brand || params.sport) {
				console.log(`🌐 [API] Request:`, url)
			}

			const response = await fetch(url)

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`)
			}

			const data: ApiResponse<ApiProduct[]> | ApiErrorResponse =
				await response.json()

			// Always log for debugging when no filters
			if (!params.search && !params.category && !params.brand && !params.sport) {
				console.log('[getProducts] API response:', {
					success: data.success,
					dataLength: data.success ? data.data?.length : 0,
					total: data.success ? data.meta?.pagination?.total : 0,
					url,
				})
			}

			// Logging for debugging when filters are applied
			if (params.search || params.category || params.brand || params.sport) {
				const queryType = params.search
					? 'Search'
					: params.category
						? 'Category Filter'
						: params.brand
							? 'Brand Filter'
							: params.sport
								? 'Sport Filter'
								: 'Filter'
				const filterValue = params.search || params.category || params.brand || params.sport
				console.log(
					`🔍 [${queryType}] ${filterValue} → ${data.success ? data.data.length : 0} results, total=${data.success ? data.meta?.pagination?.total : 0}`
				)
				console.log(
					`📊 [${queryType}] Full API response:`,
					{
						success: data.success,
						dataLength: data.success ? data.data?.length : 0,
						total: data.success ? data.meta?.pagination?.total : 0,
						url,
					}
				)

				// Show first few results to debug
				if (data.success && data.data.length > 0) {
					console.log(
						`📋 [${queryType}] First 3 results:`,
						data.data.slice(0, 3).map((item) => ({
							name: item.name,
							category: item.categoryName,
							rootCategory: item.rootCategoryName,
							article: item.sbisNomNumber,
						}))
					)
				} else if (data.success && (params.category || params.brand || params.sport)) {
					const filterType = params.category ? 'category' : params.brand ? 'brand' : 'sport'
					const filterValue = params.category || params.brand || params.sport
					console.warn(
						`⚠️ [Filter] No products found for ${filterType}:`,
						filterValue
					)
					console.log(
						`💡 [Filter] Tip: Check if products have correct ${filterType} relation or ${filterType === 'sport' ? 'rootCategoryName' : 'category.name'} field`
					)
				}
			}

			if (!data.success) {
				throw new Error(data.message || data.error)
			}

			const products = data.data.map(transformApiProduct)
			const pagination = data.meta?.pagination

			return {
				products,
				total: pagination?.total || products.length,
				page: pagination?.page || Math.floor(start / limit) + 1,
				pageSize: pagination?.pageSize || limit,
				pageCount:
					pagination?.pageCount ||
					Math.ceil((pagination?.total || products.length) / limit),
			}
		} catch (error) {
			console.error('Error fetching products:', error)
			throw error
		}
	},

	async getProduct(id: string): Promise<Product> {
		try {
			const response = await fetch(
				`${API_URL}/api/products/${encodeURIComponent(id)}`
			)

			if (!response.ok) {
				if (response.status === 404) {
					throw new Error('Product not found')
				}
				throw new Error(`API error: ${response.status}`)
			}

			const data: ApiResponse<ApiProduct> | ApiErrorResponse =
				await response.json()

			if (!data.success) {
				if (
					data.message?.includes('not found') ||
					data.error?.includes('not found')
				) {
					throw new Error('Product not found')
				}
				throw new Error(data.message || data.error || 'Failed to fetch product')
			}

			if (!data.data) {
				throw new Error('Product data is empty')
			}

			return transformApiProduct(data.data)
		} catch (error) {
			const err = error as Error
			console.error('Error fetching product:', err.message)
			// Пробрасываем ошибку дальше для обработки в компоненте
			throw err
		}
	},

	async getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
		const trimmedQuery = query.trim()
		if (!trimmedQuery) {
			return []
		}

		const searchParams = new URLSearchParams()
		searchParams.append('start', '0')
		searchParams.append('limit', '5')

		// Request only lightweight fields
		searchParams.append('fields[0]', 'name')
		searchParams.append('fields[1]', 'article')
		searchParams.append('fields[2]', 'sbisNomNumber')
		searchParams.append('fields[3]', 'categoryName')
		searchParams.append('fields[4]', 'rootCategoryName')

		searchParams.append(
			'filters[$or][0][name][$containsi]',
			trimmedQuery
		)
		searchParams.append(
			'filters[$or][1][description][$containsi]',
			trimmedQuery
		)
		searchParams.append(
			'filters[$or][2][sbisNomNumber][$containsi]',
			trimmedQuery
		)
		searchParams.append(
			'filters[$or][3][categoryName][$containsi]',
			trimmedQuery
		)

		try {
			const url = `${API_URL}/api/products?${searchParams.toString()}`
			const response = await fetch(url)

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`)
			}

			const data: ApiResponse<ApiProduct[]> | ApiErrorResponse =
				await response.json()

			if (!data.success || !Array.isArray(data.data)) {
				const errorData = data as ApiErrorResponse
				throw new Error(errorData.message || errorData.error || 'Failed to fetch suggestions')
			}

			return data.data.map((item) => ({
				id: item.id.toString(),
				name: item.name || item.description || trimmedQuery,
				article: item.article || item.sbisNomNumber || null,
				category: item.categoryName || item.rootCategoryName || null,
			}))
		} catch (error) {
			console.error('Error fetching search suggestions:', error)
			throw error
		}
	},

	async getPopularProducts(limit = 15): Promise<Product[]> {
		try {
			const response = await fetch(
				`${API_URL}/api/products/popular?limit=${limit}`
			)

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`)
			}

			const data: ApiResponse<ApiProduct[]> | ApiErrorResponse =
				await response.json()
			
			if (!data.success) {
				const errorData = data as ApiErrorResponse
				throw new Error(errorData.message || errorData.error || 'Failed to fetch popular products')
			}
			
			const successData = data as ApiResponse<ApiProduct[]>

			if (!successData.data || successData.data.length === 0) {
				return []
			}

			return successData.data.map(transformApiProduct)
		} catch (error) {
			console.error('Error fetching popular products:', error)
			throw error
		}
	},

	async getNewProducts(limit = 15): Promise<Product[]> {
		try {
			const response = await fetch(
				`${API_URL}/api/products/new?limit=${limit}`
			)

			if (!response.ok) {
				throw new Error(`API error: ${response.status}`)
			}

			const data: ApiResponse<ApiProduct[]> | ApiErrorResponse =
				await response.json()
			
			if (!data.success) {
				const errorData = data as ApiErrorResponse
				throw new Error(errorData.message || errorData.error || 'Failed to fetch new products')
			}
			
			const successData = data as ApiResponse<ApiProduct[]>

			if (!successData.data || successData.data.length === 0) {
				return []
			}

			return successData.data.map(transformApiProduct)
		} catch (error) {
			console.error('Error fetching new products:', error)
			throw error
		}
	},
}
