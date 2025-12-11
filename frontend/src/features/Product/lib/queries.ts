import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { productApi } from '../api/productApi'
import type { ProductFilters, PaginationParams } from '@/shared/types'

// Query keys
export const productKeys = {
	all: ['products'] as const,
	lists: () => [...productKeys.all, 'list'] as const,
	list: (filters: ProductFilters & PaginationParams) => {
		// Create unique key based on all filters (excluding pagination params)
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { start, limit, page, pageSize, offset, ...filterParams } = filters

		// Normalize filter object for consistent key generation
		const normalizedFilters = {
			search: filterParams.search || null,
			category: filterParams.category || null,
			brand: filterParams.brand || null,
			sport: filterParams.sport || null,
			minPrice: filterParams.minPrice ?? null,
			maxPrice: filterParams.maxPrice ?? null,
			sortBy: filterParams.sortBy || null,
			sortOrder: filterParams.sortOrder || null,
		}

		return [...productKeys.lists(), normalizedFilters] as const
	},
	details: () => [...productKeys.all, 'detail'] as const,
	detail: (id: string) => [...productKeys.details(), id] as const,
}

// Hook for infinite scroll products
export const useInfiniteProducts = (filters: ProductFilters = {}) => {
	return useInfiniteQuery({
		queryKey: productKeys.list(filters),
		queryFn: async ({ pageParam = 0 }) => {
			const params = {
				...filters,
				start: pageParam,
				limit: 20,
			}

			return productApi.getProducts(params)
		},
		getNextPageParam: (lastPage, allPages) => {
			const totalLoaded = allPages.reduce(
				(acc, page) => acc + page.products.length,
				0
			)

			// Check if we have more products to load
			return totalLoaded < lastPage.total ? totalLoaded : undefined
		},
		initialPageParam: 0,
		staleTime: 0, // Always refetch when filters change
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false, // Don't refetch on window focus
		enabled: true, // Always enabled
		refetchOnMount: true, // Refetch on mount
	})
}

// Hook for single product
export const useProduct = (id: string) => {
	return useQuery({
		queryKey: productKeys.detail(id),
		queryFn: () => productApi.getProduct(id),
		enabled: !!id,
		staleTime: 10 * 60 * 1000, // 10 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
	})
}

// Hook for products with regular pagination (if needed)
export const useProducts = (
	filters: ProductFilters & PaginationParams = {}
) => {
	return useQuery({
		queryKey: productKeys.list(filters),
		queryFn: () => productApi.getProducts(filters),
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	})
}
