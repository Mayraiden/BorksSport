'use client'

import {
	createContext,
	useContext,
	useState,
	useCallback,
	ReactNode,
	useEffect,
} from 'react'
import { useDebounce } from '../hooks/useDebounce'
import type { ProductFilters } from '@/shared/types'

type SearchContextType = {
	searchQuery: string
	debouncedSearchQuery: string
	filters: ProductFilters
	setSearchQuery: (query: string) => void
	setFilters: (filters: ProductFilters) => void
	updateFilters: (newFilters: Partial<ProductFilters>) => void
	clearSearch: () => void
	clearFilters: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

type SearchProviderProps = {
	children: ReactNode
}

export const SearchProvider = ({ children }: SearchProviderProps) => {
	const [searchQuery, setSearchQuery] = useState('')
	const [filters, setFilters] = useState<ProductFilters>({})

	// Debounce search query to avoid too many API calls
	const debouncedSearchQuery = useDebounce(searchQuery, 500)

	// Initialize search from URL params
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const urlParams = new URLSearchParams(window.location.search)
			const searchParam = urlParams.get('search')
			if (searchParam) {
				setSearchQuery(searchParam)
			}
		}
	}, [])

	const updateFilters = useCallback((newFilters: Partial<ProductFilters>) => {
		setFilters((prev) => ({ ...prev, ...newFilters }))
	}, [])

	const clearSearch = useCallback(() => {
		setSearchQuery('')
	}, [])

	const clearFilters = useCallback(() => {
		setFilters({})
	}, [])

	const value: SearchContextType = {
		searchQuery,
		debouncedSearchQuery,
		filters: { ...filters, search: debouncedSearchQuery },
		setSearchQuery,
		setFilters,
		updateFilters,
		clearSearch,
		clearFilters,
	}

	return (
		<SearchContext.Provider value={value}>{children}</SearchContext.Provider>
	)
}

export const useSearch = () => {
	const context = useContext(SearchContext)
	if (context === undefined) {
		throw new Error('useSearch must be used within a SearchProvider')
	}
	return context
}
