import type {
	ApiProduct,
	ApiResponse,
	ApiErrorResponse,
	ProductFilters,
	PaginationParams,
	Product,
	ProductSize,
	ProductColor,
	SearchSuggestion,
} from '@/shared/types'
import { safeArrayFrom, safeSetFrom } from '@/shared/lib/safeUtils'

const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.NEXT_STRAPI_URL || 'http://localhost:1337'

/**
 * Извлекает PhotoURL из строки /img?params=... (на случай, если на бэкенде не была обработана)
 * Работает только в браузере (использует atob)
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

// Transform API product to our Product type
// Возвращает null при ошибке вместо падения приложения
const transformApiProduct = (apiProduct: ApiProduct): Product | null => {
	try {
		return transformApiProductInternal(apiProduct)
	} catch (error) {
		console.error('[ProductApi] Error transforming product:', error, {
			productId: apiProduct.id,
			productName: apiProduct.name,
		})
		return null
	}
}

// Внутренняя функция трансформации
const transformApiProductInternal = (apiProduct: ApiProduct): Product => {
	// Изображения могут быть обработаны на бэкенде, но проверяем на всякий случай
	const images = (apiProduct.images || [])
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

	// Собираем уникальные размеры и цвета только из вариантов с stock > 0
	// Варианты с stock = 0 уже отфильтрованы на бэкенде, но на всякий случай фильтруем еще раз
	const variants = (apiProduct.variants || []).filter(
		(v) => v.stock !== null && v.stock !== undefined && v.stock > 0
	)
	
	// Формируем список товаров для извлечения цветов/размеров:
	// - Если у основного товара stock > 0, включаем его
	// - Всегда включаем варианты с stock > 0
	const productsWithStock = []
	if (apiProduct.stock && apiProduct.stock > 0) {
		productsWithStock.push(apiProduct)
	}
	productsWithStock.push(...variants)

	// Извлекаем уникальные размеры только из товаров с stock > 0
	// Используем безопасные функции для предотвращения ошибок "object is not iterable"
	const sizeValues = productsWithStock
		.map((p) => p.size)
		.filter((size): size is string => size !== null && size !== undefined)
	const uniqueSizes = safeArrayFrom(safeSetFrom(sizeValues))

	// Извлекаем уникальные цвета только из товаров с stock > 0
	const colorValues = productsWithStock
		.map((p) => p.color)
		.filter((color): color is string => color !== null && color !== undefined)
	const uniqueColors = safeArrayFrom(safeSetFrom(colorValues))

	// Создаем массивы для селекторов
	const sizes: ProductSize[] = uniqueSizes.map((size, index) => ({
		id: `size-${index}`,
		name: size,
		value: size,
	}))

	const colors: ProductColor[] = uniqueColors.map((color, index) => {
		// Пробуем определить hex цвет по названию (базовая логика)
		const colorLower = color.toLowerCase()
		let hex = '#CCCCCC' // серый по умолчанию

		const colorMap: Record<string, string> = {
			red: '#FF0000',
			красный: '#FF0000',
			blue: '#0000FF',
			синий: '#0000FF',
			green: '#008000',
			зеленый: '#008000',
			yellow: '#FFFF00',
			желтый: '#FFFF00',
			black: '#000000',
			черный: '#000000',
			white: '#FFFFFF',
			белый: '#FFFFFF',
			gray: '#808080',
			grey: '#808080',
			серый: '#808080',
			brown: '#A52A2A',
			коричневый: '#A52A2A',
			orange: '#FFA500',
			оранжевый: '#FFA500',
			purple: '#800080',
			фиолетовый: '#800080',
			pink: '#FFC0CB',
			розовый: '#FFC0CB',
		}

		if (colorMap[colorLower]) {
			hex = colorMap[colorLower]
		}

		return {
			id: `color-${index}`,
			name: color,
			hex,
		}
	})

	// Трансформируем варианты (без рекурсии - варианты не должны содержать свои варианты)
	// Используем уже отфильтрованные варианты с stock > 0
	const transformedVariants = variants.map((variant) => {
		// Используем упрощенную трансформацию для вариантов
		return {
			id: variant.id.toString(),
			article: variant.article || variant.sbisNomNumber || 'Не указано',
			name: variant.name || 'Без названия',
			brand: variant.categoryName || 'Не указано',
			price: variant.price || 0,
			images: (variant.images || []).map((url, index) => ({
				id: index.toString(),
				url: url,
				alt: variant.name || 'Изображение товара',
			})),
			colors: [], // Варианты не содержат свои варианты
			sizes: [],
			description: variant.description,
			characteristics: {
				Категория: variant.categoryName || 'Не указано',
				Артикул: variant.article || variant.sbisNomNumber || 'Не указано',
				Единица: variant.unit || 'шт',
			},
			size: variant.size || null,
			color: variant.color || null,
			weight: variant.weight || null,
			length: variant.length || null,
			width: variant.width || null,
			height: variant.height || null,
			stock: variant.stock || null,
		}
	})

	// Формируем характеристики
	const characteristics: Record<string, string> = {
		Категория: apiProduct.categoryName || 'Не указано',
		Артикул: apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
		Единица: apiProduct.unit || 'шт',
	}

	// Добавляем размер, цвет, вес, габариты в характеристики, если они есть
	if (apiProduct.size) {
		characteristics['Размер'] = apiProduct.size
	}
	if (apiProduct.color) {
		characteristics['Цвет'] = apiProduct.color
	}
	if (apiProduct.weight) {
		characteristics['Вес'] = `${apiProduct.weight} г`
	}
	if (apiProduct.length || apiProduct.width || apiProduct.height) {
		const dimensions = [
			apiProduct.length && `Длина: ${apiProduct.length} мм`,
			apiProduct.width && `Ширина: ${apiProduct.width} мм`,
			apiProduct.height && `Высота: ${apiProduct.height} мм`,
		]
			.filter(Boolean)
			.join(', ')
		if (dimensions) {
			characteristics['Габариты'] = dimensions
		}
	}

	return {
		id: apiProduct.id.toString(),
		article: apiProduct.article || apiProduct.sbisNomNumber || 'Не указано',
		name: apiProduct.name || 'Без названия',
		brand: apiProduct.categoryName || 'Не указано',
		price: apiProduct.price || 0,
		images: validImages,
		colors,
		sizes,
		description: apiProduct.description,
		characteristics,
		variants: transformedVariants.length > 0 ? transformedVariants : undefined,
		size: apiProduct.size || null,
		color: apiProduct.color || null,
		weight: apiProduct.weight || null,
		length: apiProduct.length || null,
		width: apiProduct.width || null,
		height: apiProduct.height || null,
		stock: apiProduct.stock || null,
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

		// Category filter (level 1 - product categories like "Обувь", "Сумки")
		if (params.category) {
			console.log('🔍 [Filter] Category filter:', params.category)
			if (params.category.includes(',')) {
				const categories = params.category.split(',').filter(Boolean)
				categories.forEach((category, index) => {
					searchParams.append(
						`filters[$or][${index}][category][name][$eq]`,
						category.trim()
					)
				})
			} else {
				searchParams.append('filters[category][name][$eq]', params.category.trim())
			}
		}

		// Brand filter (level 2 - brands like "OSAKA", "Rawlings")
		if (params.brand) {
			console.log('🔍 [Filter] Brand filter:', params.brand)
			if (params.brand.includes(',')) {
				const brands = params.brand.split(',').filter(Boolean)
				brands.forEach((brand, index) => {
					searchParams.append(
						`filters[$or][${index}][brand][name][$eq]`,
						brand.trim()
					)
				})
			} else {
				searchParams.append('filters[brand][name][$eq]', params.brand.trim())
			}
		}

		// Sport type filter (level 0 - main categories like "Бейсбол и Софтбол")
		if (params.sport) {
			console.log('🔍 [Filter] Sport type filter:', params.sport)
			if (params.sport.includes(',')) {
				const sports = params.sport.split(',').filter(Boolean)
				sports.forEach((sport, index) => {
					searchParams.append(
						`filters[$or][${index}][sportCategory][name][$eq]`,
						sport.trim()
					)
				})
			} else {
				searchParams.append('filters[sportCategory][name][$eq]', params.sport.trim())
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

			// Безопасная трансформация с фильтрацией null значений
			const products = data.data
				.map(transformApiProduct)
				.filter((p): p is Product => p !== null)
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

			const product = transformApiProduct(data.data)
			if (!product) {
				throw new Error('Failed to transform product data')
			}

			return product
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

			// Безопасная трансформация с фильтрацией null значений
			return successData.data
				.map(transformApiProduct)
				.filter((p): p is Product => p !== null)
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

			// Безопасная трансформация с фильтрацией null значений
			return successData.data
				.map(transformApiProduct)
				.filter((p): p is Product => p !== null)
		} catch (error) {
			console.error('Error fetching new products:', error)
			throw error
		}
	},
}
