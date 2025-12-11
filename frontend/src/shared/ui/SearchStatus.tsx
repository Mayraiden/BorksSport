'use client'

import { memo } from 'react'
import { useSearch } from '@/shared/lib/contexts/SearchContext'

type SearchStatusProps = {
	className?: string
}

export const SearchStatus = memo(({ className = '' }: SearchStatusProps) => {
	const { searchQuery, debouncedSearchQuery } = useSearch()

	if (!searchQuery) {
		return null
	}

	const isSearching = searchQuery !== debouncedSearchQuery
	const searchEngine = searchQuery ? 'Meilisearch' : 'Strapi'

	return (
		<div
			className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div className="w-2 h-2 bg-blue-500 rounded-full"></div>
					<span className="text-sm font-medium text-blue-900">
						Поиск через {searchEngine}
					</span>
				</div>
				{isSearching && (
					<div className="flex items-center gap-2 text-sm text-blue-600">
						<div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
						<span>Обработка...</span>
					</div>
				)}
			</div>
			<div className="mt-2 text-xs text-blue-700">
				Запрос: <span className="font-mono">&quot;{searchQuery}&quot;</span>
			</div>
		</div>
	)
})

SearchStatus.displayName = 'SearchStatus'
