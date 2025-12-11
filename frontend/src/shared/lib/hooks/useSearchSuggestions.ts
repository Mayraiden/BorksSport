'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { productApi } from '@/features/Product/api/productApi'
import { useDebounce } from './useDebounce'
import type { SearchSuggestion } from '@/shared/types'

const suggestionKeys = {
	list: (query: string) => ['searchSuggestions', query] as const,
}

export const useSearchSuggestions = (query: string) => {
	const trimmedQuery = query.trim()
	const debouncedQuery = useDebounce(trimmedQuery, 250)
	const enabled = debouncedQuery.length >= 2

	const queryResult = useQuery({
		queryKey: suggestionKeys.list(debouncedQuery),
		queryFn: () => productApi.getSearchSuggestions(debouncedQuery),
		enabled,
		staleTime: 60 * 1000,
		gcTime: 5 * 60 * 1000,
		retry: 1,
	})

	const suggestions = useMemo<SearchSuggestion[]>(() => {
		if (!enabled) {
			return []
		}

		return queryResult.data ?? []
	}, [enabled, queryResult.data])

	return {
		...queryResult,
		suggestions,
		hasQuery: enabled,
	}
}

