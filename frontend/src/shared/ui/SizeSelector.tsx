'use client'

import { useState, useEffect } from 'react'
import type { ProductSize } from '../types'

type SizeSelectorProps = {
	sizes: ProductSize[]
	selectedSizeId?: string
	onSizeChange: (sizeId: string) => void
	availableSizeIds?: string[] // ID доступных размеров (для текущего цвета)
	className?: string
}

export const SizeSelector = ({
	sizes,
	selectedSizeId,
	onSizeChange,
	availableSizeIds,
	className = '',
}: SizeSelectorProps) => {
	const [selectedId, setSelectedId] = useState(selectedSizeId || sizes[0]?.id)

	// Синхронизируем selectedId с selectedSizeId из пропсов
	useEffect(() => {
		if (selectedSizeId) {
			setSelectedId(selectedSizeId)
		}
	}, [selectedSizeId])

	const handleSizeSelect = (sizeId: string) => {
		// Проверяем, доступен ли размер
		if (availableSizeIds && !availableSizeIds.includes(sizeId)) {
			return // Не позволяем выбрать недоступный размер
		}
		setSelectedId(sizeId)
		onSizeChange(sizeId)
	}

	if (!sizes.length) return null

	// Определяем доступные размеры (если не указаны, все доступны)
	const isSizeAvailable = (sizeId: string): boolean => {
		if (!availableSizeIds) return true
		return availableSizeIds.includes(sizeId)
	}

	return (
		<div className={`flex flex-col gap-4 max-sm:gap-3 ${className}`}>
			<label className="text-base font-bold leading-[1.3125] text-[#121212] max-sm:text-sm">
				Размер
			</label>
			<div className="flex gap-3 flex-wrap max-sm:gap-2">
				{sizes.map((size) => {
					const isAvailable = isSizeAvailable(size.id)
					const isSelected = selectedId === size.id
					
					return (
						<button
							key={size.id}
							onClick={() => handleSizeSelect(size.id)}
							disabled={!isAvailable}
							className={`w-[52px] h-10 flex items-center justify-center text-base font-normal leading-[1.3125] rounded-[4px] transition-colors duration-200 max-sm:w-12 max-sm:h-9 max-sm:text-sm ${
								isSelected
									? 'bg-[#7B1931] text-[#F5F5F5]'
									: isAvailable
									? 'bg-white text-[#121212] border border-[rgba(160,164,168,0.25)] hover:bg-gray/10'
									: 'bg-[#F5F5F5] text-[#A0A4A8] border border-[#E0E0E0] cursor-not-allowed opacity-60'
							}`}
							aria-label={`Выбрать размер ${size.value}${!isAvailable ? ' (недоступен)' : ''}`}
						>
							{size.value}
						</button>
					)
				})}
			</div>
		</div>
	)
}
