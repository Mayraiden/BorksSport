'use client'

import { useState, useCallback, memo, useRef, useEffect, useMemo } from 'react'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/ssr'

import type { SearchSuggestion } from '@/shared/types'
import { useSearchSuggestions } from '@/shared/lib/hooks/useSearchSuggestions'

type ISearchProps = {
	type: 'text'
	className: string
	placeholder?: string
	onSearch?: (query: string) => void
	value?: string
	containerClassName?: string
}

export const SearchForm = memo<ISearchProps>(
	({
		type,
		className,
		placeholder = 'Поиск...',
		onSearch,
		value: controlledValue,
		containerClassName = '',
	}) => {
		const [inputValue, setInputValue] = useState(
			controlledValue ?? ''
		)
		const [isFocused, setIsFocused] = useState(false)
		const [activeIndex, setActiveIndex] = useState(-1)
		const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null)

		useEffect(() => {
			if (controlledValue !== undefined) {
				setInputValue(controlledValue)
			}
		}, [controlledValue])

		const {
			suggestions,
			hasQuery,
			isLoading,
			isError,
		} = useSearchSuggestions(inputValue)

		const hasSuggestions = suggestions.length > 0
		const noResults =
			hasQuery &&
			!isLoading &&
			!isError &&
			!hasSuggestions &&
			inputValue.length >= 2
		const shouldShowDropdown =
			isFocused &&
			hasQuery &&
			(isLoading || hasSuggestions || noResults || isError)

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				const newValue = e.target.value
				setInputValue(newValue)
			},
			[]
		)

		const handleSuggestionSelect = useCallback(
			(suggestion: SearchSuggestion) => {
				const nextValue =
					suggestion.name ||
					suggestion.article ||
					suggestion.category ||
					''
				if (!nextValue) {
					return
				}

			setInputValue(nextValue)

			onSearch?.(nextValue)
			setIsFocused(false)
			setActiveIndex(-1)
		},
		[onSearch]
	)

		const resetBlurTimeout = useCallback(() => {
			if (blurTimeoutRef.current) {
				clearTimeout(blurTimeoutRef.current)
				blurTimeoutRef.current = null
			}
		}, [])

		const handleFocus = useCallback(() => {
			resetBlurTimeout()
			setIsFocused(true)
		}, [resetBlurTimeout])

		const handleBlur = useCallback(() => {
			resetBlurTimeout()
			blurTimeoutRef.current = setTimeout(() => {
				setIsFocused(false)
				setActiveIndex(-1)
			}, 100)
		}, [resetBlurTimeout])

		useEffect(() => {
			return () => {
				resetBlurTimeout()
			}
		}, [resetBlurTimeout])

		useEffect(() => {
			setActiveIndex(-1)
		}, [inputValue])

		const handleKeyDown = useCallback(
			(e: React.KeyboardEvent<HTMLInputElement>) => {
				if (!shouldShowDropdown) {
					if (e.key === 'Enter') {
						onSearch?.(inputValue)
					}
					return
				}

				if (e.key === 'ArrowDown' && suggestions.length > 0) {
					e.preventDefault()
					setActiveIndex((prev) => {
						const nextIndex =
							prev + 1 < suggestions.length ? prev + 1 : 0
						return nextIndex
					})
					return
				}

				if (e.key === 'ArrowUp' && suggestions.length > 0) {
					e.preventDefault()
					setActiveIndex((prev) => {
						if (prev <= 0) {
							return suggestions.length - 1
						}
						return prev - 1
					})
					return
				}

				if (e.key === 'Enter') {
					if (activeIndex >= 0 && suggestions[activeIndex]) {
						e.preventDefault()
						handleSuggestionSelect(suggestions[activeIndex])
					} else {
						onSearch?.(inputValue)
					}
				}

				if (e.key === 'Escape') {
					setIsFocused(false)
					setActiveIndex(-1)
				}
			},
			[
				activeIndex,
				handleSuggestionSelect,
				onSearch,
				shouldShowDropdown,
				suggestions,
				inputValue,
			]
		)

		const dropdownContent = useMemo(() => {
			if (!shouldShowDropdown) {
				return null
			}

			if (isLoading) {
				return (
					<div className="px-4 py-3 text-sm text-gray flex items-center gap-2">
						<div className="w-3 h-3 border-2 border-burgundy border-t-transparent rounded-full animate-spin" />
						<span>Ищем подсказки…</span>
					</div>
				)
			}

			if (isError) {
				return (
					<div className="px-4 py-3 text-sm text-red-500">
						Не удалось загрузить подсказки
					</div>
				)
			}

			if (noResults) {
				return (
					<div className="px-4 py-3 text-sm text-gray">
						Ничего не найдено
					</div>
				)
			}

			return (
				<ul
					id="search-suggestions-list"
					role="listbox"
					aria-label="Подсказки поиска"
					className="max-h-72 overflow-y-auto"
				>
					{suggestions.map((suggestion, index) => {
						const isActive = index === activeIndex
						return (
							<li key={suggestion.id} role="option" aria-selected={isActive}>
								<button
									type="button"
									className={`w-full px-4 py-3 text-left transition-colors duration-150 ${
										isActive
											? 'bg-gray/20'
											: 'bg-white hover:bg-gray/10'
									}`}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => handleSuggestionSelect(suggestion)}
								>
									<p className="text-sm font-semibold text-black">
										{suggestion.name}
									</p>
									<div className="text-xs text-gray flex gap-2">
										{suggestion.article && (
											<span>Артикул: {suggestion.article}</span>
										)}
										{suggestion.category && (
											<span>{suggestion.category}</span>
										)}
									</div>
								</button>
							</li>
						)
					})}
				</ul>
			)
		}, [
			activeIndex,
			handleSuggestionSelect,
			isError,
			isLoading,
			noResults,
			shouldShowDropdown,
			suggestions,
		])

		return (
			<div className={`w-full h-full relative ${containerClassName}`}>
				<input
					type={type}
					placeholder={placeholder}
					className={className}
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					onFocus={handleFocus}
					onBlur={handleBlur}
					role="combobox"
					aria-expanded={shouldShowDropdown}
					aria-autocomplete="list"
					aria-controls="search-suggestions-list"
				/>
				<MagnifyingGlassIcon
					className="absolute right-2 bottom-2.5"
					size={20}
				/>

				{shouldShowDropdown && (
					<div className="absolute left-0 right-0 top-[calc(100%+0.25rem)] bg-white border border-gray/20 rounded-md shadow-lg z-50 overflow-hidden">
						{dropdownContent}
					</div>
				)}
			</div>
		)
	}
)

SearchForm.displayName = 'SearchForm'
