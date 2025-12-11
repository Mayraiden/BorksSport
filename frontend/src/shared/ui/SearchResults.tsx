'use client'

import { memo } from 'react'
import { useSearch } from '@/shared/lib/contexts/SearchContext'

type SearchResultsProps = {
	className?: string
}

export const SearchResults = memo(({ className = '' }: SearchResultsProps) => {
	const { searchQuery, debouncedSearchQuery } = useSearch()

	if (!searchQuery && !debouncedSearchQuery) {
		return null
	}

	return (
		<div className={`space-y-3 ${className}`}>
			{/* Search results header */}
			<div className="bg-white rounded-lg p-4">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-lg font-semibold text-gray-900">
							Результаты поиска
						</h3>
						<p className="text-sm text-gray-600">
							По запросу: <span className="font-medium">&quot;{searchQuery}&quot;</span>
						</p>
					</div>
					{searchQuery !== debouncedSearchQuery && (
						<div className="flex items-center gap-2 text-sm text-gray-500">
							<div className="w-3 h-3 border-2 border-burgundy border-t-transparent rounded-full animate-spin"></div>
							<span>Поиск...</span>
						</div>
					)}
				</div>
			</div>
		</div>
	)
})

SearchResults.displayName = 'SearchResults'
