export type IBuyButtonProps = {
	type: 'button' | 'submit'
	text: string
	disabled?: boolean
	loading?: boolean
	className?: string
	onClick?: () => void
	variant?: 'card' | 'product-page'
	productId?: string // ID товара для добавления в корзину
	quantity?: number // Количество (по умолчанию 1)
	maxQuantity?: number // Максимально доступное количество (для блокировки "+")
}

export type FavoriteProduct = {
	id: string
	name: string
	brand: string
	price: number
	image: string
}

export type FavoritesState = {
	products: FavoriteProduct[]
	isEmpty: boolean
}

// Auth types
export type LoginFormData = {
	email: string
	password: string
}

export type RegisterFormData = {
	name: string
	email: string
	password: string
	confirmPassword: string
}

export type AuthMode = 'login' | 'register'

// Product types
export type ProductColor = {
	id: string
	name: string
	hex: string
}

export type ProductSize = {
	id: string
	name: string
	value: string
}

export type ProductImage = {
	id: string
	url: string
	alt: string
}

export type Product = {
	id: string
	article: string
	name: string
	brand: string
	price: number
	images: ProductImage[]
	colors: ProductColor[]
	sizes: ProductSize[]
	description?: string
	characteristics?: Record<string, string>
	delivery?: string[]
	variants?: Product[] // Variants of the product (different sizes/colors)
	size?: string | null
	color?: string | null
	weight?: number | null
	length?: number | null
	width?: number | null
	height?: number | null
	stock?: number | null
	availableStock?: number | null
}

export type SearchSuggestion = {
	id: string
	name: string
	article?: string | null
	category?: string | null
}

// API types
export type ApiProduct = {
	id: number
	documentId: string
	name: string
	description: string
	price: number
	article: string | null
	unit: string
	images: string[] // Array of image URLs (already processed on backend)
	published: boolean
	sbisId: number
	sbisExternalId: string
	sbisNomNumber: string
	categoryName: string
	rootCategoryName: string | null
	lastSyncAt: string
	createdAt: string
	updatedAt: string
	publishedAt: string
	locale: string | null
	size: string | null
	color: string | null
	weight: number | null
	length: number | null
	width: number | null
	height: number | null
	stock: number | null
	reservedStock?: number | null
	soldButNotSynced?: number | null
	availableStock?: number | null
	variants?: ApiProduct[] // Variants of the product (same sbisNomNumber/article)
}

export type ApiResponse<T> = {
	success: true
	data: T
	meta?: {
		pagination: {
			page: number
			pageSize: number
			total: number
			pageCount: number
		}
	}
}

export type ApiErrorResponse = {
	success: false
	error: string
	message: string
}

export type ProductFilters = {
	search?: string
	category?: string
	brand?: string
	sport?: string // Вид спорта (level 0 категории)
	minPrice?: number
	maxPrice?: number
	colors?: string[]
	sizes?: string[]
	sortBy?: 'name' | 'price' | 'createdAt'
	sortOrder?: 'asc' | 'desc'
}

export type PaginationParams = {
	start?: number
	limit?: number
	page?: number
	pageSize?: number
	offset?: number
}
