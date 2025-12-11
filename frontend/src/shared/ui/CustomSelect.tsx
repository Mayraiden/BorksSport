'use client'

import { memo, useState, useRef, useEffect } from 'react'
import { CaretDown } from '@phosphor-icons/react'

export type SelectOption = {
	value: string
	label: string
}

type CustomSelectProps = {
	options: SelectOption[]
	value: string
	onChange: (value: string) => void
	placeholder?: string
	className?: string
}

/**
 * Кастомный Select компонент под дизайн магазина
 */
export const CustomSelect = memo(
	({
		options,
		value,
		onChange,
		placeholder = 'Выберите...',
		className = '',
	}: CustomSelectProps) => {
		const [isOpen, setIsOpen] = useState(false)
		const selectRef = useRef<HTMLDivElement>(null)
		const dropdownRef = useRef<HTMLDivElement>(null)

		const selectedOption = options.find((opt) => opt.value === value)

		// Закрытие при клике вне компонента
		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					selectRef.current &&
					!selectRef.current.contains(event.target as Node)
				) {
					setIsOpen(false)
				}
			}

			if (isOpen) {
				document.addEventListener('mousedown', handleClickOutside)
			}

			return () => {
				document.removeEventListener('mousedown', handleClickOutside)
			}
		}, [isOpen])

		const handleSelect = (optionValue: string) => {
			onChange(optionValue)
			setIsOpen(false)
		}

		return (
			<div
				className={`relative ${className}`}
				ref={selectRef}
				style={{ zIndex: isOpen ? 9999 : 'auto' }}
			>
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-md flex items-center justify-between gap-2 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy transition-all duration-200"
					aria-haspopup="listbox"
					aria-expanded={isOpen}
				>
					<span className="text-sm font-medium text-gray-900">
						{selectedOption?.label || placeholder}
					</span>
					<CaretDown
						size={16}
						weight="bold"
						className={`text-gray-500 transition-transform duration-200 ${
							isOpen ? 'rotate-180' : ''
						}`}
					/>
				</button>

				{isOpen && (
					<div
						ref={dropdownRef}
						className="absolute z-[9999] w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden"
					>
					<ul role="listbox" className="max-h-60 overflow-auto">
						{options.map((option) => (
							<li
								key={option.value}
								role="option"
								aria-selected={option.value === value}
							>
								<button
									type="button"
									onClick={() => handleSelect(option.value)}
									className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${
										option.value === value
											? 'bg-burgundy/10 text-burgundy font-medium'
												: 'text-gray-700 hover:bg-gray-50'
										}`}
									>
										{option.label}
									</button>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		)
	}
)

CustomSelect.displayName = 'CustomSelect'
