'use client'

import { memo, useMemo, useCallback, useEffect, useRef } from 'react'
import { useInfiniteProducts } from '../lib/queries'
import { ItemCard } from '@/shared/ui/ItemCard'
import type { ProductFilters } from '@/shared/types'

export const InfiniteProductGrid = memo<{
	filters?: ProductFilters
	className?: string
}>(({ filters = {}, className = '' }) => {
	const {
		data,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		error,
	} = useInfiniteProducts(filters)

	// Memoize expensive calculations
	const allProducts = useMemo(
		() => data?.pages.flatMap((page) => page.products) || [],
		[data?.pages]
	)

	const handleProductClick = useCallback((productId: string) => {
		window.location.href = `/product/${productId}`
	}, [])

	// Intersection Observer for infinite scroll
	const observerTarget = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage()
				}
			},
			{ threshold: 1.0 }
		)

		const currentTarget = observerTarget.current
		if (currentTarget) {
			observer.observe(currentTarget)
		}

		return () => {
			if (currentTarget) {
				observer.unobserve(currentTarget)
			}
		}
	}, [fetchNextPage, hasNextPage, isFetchingNextPage])

	// Loading skeleton
	const LoadingSkeleton = memo(() => (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{Array.from({ length: 8 }).map((_, index) => (
				<div key={index} className="animate-pulse">
					<div className="w-full h-64 bg-gray/20 rounded-lg mb-3"></div>
					<div className="h-4 bg-gray/20 rounded mb-2"></div>
					<div className="h-3 bg-gray/20 rounded w-2/3 mb-2"></div>
					<div className="h-4 bg-gray/20 rounded w-1/2"></div>
				</div>
			))}
		</div>
	))

	LoadingSkeleton.displayName = 'LoadingSkeleton'

	// Error state
	const ErrorState = memo(() => (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="text-center">
				<h3 className="text-lg font-medium text-gray-900 mb-2">
					Ошибка загрузки товаров
				</h3>
				<p className="text-gray-500 mb-4">
					Не удалось загрузить товары. Попробуйте обновить страницу.
				</p>
				<button
					onClick={() => window.location.reload()}
					className="bg-burgundy text-white px-4 py-2 rounded-lg hover:bg-burgundy/90 transition-colors duration-200"
				>
					Обновить страницу
				</button>
			</div>
		</div>
	))

	ErrorState.displayName = 'ErrorState'

	// Empty state
	const EmptyState = memo(() => (
		<div className="flex flex-col items-center justify-center py-12">
			<div className="text-center">
				<h3 className="text-lg font-medium text-gray-900 mb-2">
					Товары не найдены
				</h3>
				<p className="text-gray-500">
					Попробуйте изменить параметры поиска или фильтры.
				</p>
			</div>
		</div>
	))

	EmptyState.displayName = 'EmptyState'

	if (isLoading) {
		return <LoadingSkeleton />
	}

	if (error) {
		return <ErrorState />
	}

	if (allProducts.length === 0) {
		return <EmptyState />
	}

	return (
		<div className={className}>
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{allProducts.map((product, index) => (
					<ItemCard
						key={`${product.id}-${index}`}
						product={product}
						onClick={() => handleProductClick(product.id)}
					/>
				))}
			</div>

			{/* Load more button */}
			{hasNextPage && !isFetchingNextPage && (
				<div className="flex justify-center py-8">
					<button
						onClick={() => fetchNextPage()}
						className="px-8 py-3 bg-[#f5f5f5] text-gray-700 rounded-lg hover:bg-gray/30 transition-colors duration-200 font-medium"
					>
						Загрузить еще
					</button>
				</div>
			)}

			{/* Loading indicator */}
			{isFetchingNextPage && (
				<div className="flex justify-center py-8">
					<div className="w-4 h-4 border-2 border-burgundy border-t-transparent rounded-full animate-spin"></div>
				</div>
			)}

			{/* End message */}
			{!hasNextPage && allProducts.length > 0 && (
				<div className="flex justify-center py-8">
					<p className="text-gray-500">
						Все товары загружены ({allProducts.length} товаров)
					</p>
				</div>
			)}

			{/* Observer target */}
			<div ref={observerTarget} className="h-1" />
		</div>
	)
})

InfiniteProductGrid.displayName = 'InfiniteProductGrid'
