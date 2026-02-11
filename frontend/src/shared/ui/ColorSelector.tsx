'use client'

import { useState, useEffect } from 'react'
import type { ProductColor } from '../types'

type ColorSelectorProps = {
	colors: ProductColor[]
	selectedColorId?: string
	onColorChange: (colorId: string) => void
	availableColorIds?: string[] // ID доступных цветов (для текущего размера)
	className?: string
}

export const ColorSelector = ({
	colors,
	selectedColorId,
	onColorChange,
	availableColorIds,
	className = '',
}: ColorSelectorProps) => {
	const [selectedId, setSelectedId] = useState(selectedColorId || colors[0]?.id)

	// Синхронизируем selectedId с selectedColorId из пропсов
	useEffect(() => {
		if (selectedColorId) {
			setSelectedId(selectedColorId)
		}
	}, [selectedColorId])

	const handleColorSelect = (colorId: string) => {
		// Проверяем, доступен ли цвет
		if (availableColorIds && !availableColorIds.includes(colorId)) {
			return // Не позволяем выбрать недоступный цвет
		}
		setSelectedId(colorId)
		onColorChange(colorId)
	}

	if (!colors.length) return null

	// Определяем доступные цвета (если не указаны, все доступны)
	const isColorAvailable = (colorId: string): boolean => {
		if (!availableColorIds) return true
		return availableColorIds.includes(colorId)
	}

	return (
		<div className={`flex flex-col gap-4 max-sm:gap-3 ${className}`}>
			<label className="text-base font-bold leading-[1.3125] text-[#121212] max-sm:text-sm">
				Цвет
			</label>
			<div className="flex gap-3 max-sm:gap-2 flex-wrap">
				{colors.map((color) => {
					const isAvailable = isColorAvailable(color.id)
					const isSelected = selectedId === color.id
					
					return (
						<button
							key={color.id}
							onClick={() => handleColorSelect(color.id)}
							disabled={!isAvailable}
							className={`px-4 py-2 rounded-[4px] border-2 transition-all duration-200 text-base font-normal max-sm:text-sm ${
								isSelected
									? 'border-[#7B1931] bg-[#7B1931] text-white'
									: isAvailable
									? 'border-[#A0A4A8] bg-white text-[#121212] hover:border-[#7B1931] hover:text-[#7B1931]'
									: 'border-[#E0E0E0] bg-[#F5F5F5] text-[#A0A4A8] cursor-not-allowed opacity-60'
							}`}
							aria-label={`Выбрать цвет ${color.name}${!isAvailable ? ' (недоступен)' : ''}`}
						>
							{color.name}
						</button>
					)
				})}
			</div>
		</div>
	)
}
