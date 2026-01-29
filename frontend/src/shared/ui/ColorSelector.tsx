'use client'

import { useState } from 'react'
import type { ProductColor } from '../types'

type ColorSelectorProps = {
	colors: ProductColor[]
	selectedColorId?: string
	onColorChange: (colorId: string) => void
	className?: string
}

export const ColorSelector = ({
	colors,
	selectedColorId,
	onColorChange,
	className = '',
}: ColorSelectorProps) => {
	const [selectedId, setSelectedId] = useState(selectedColorId || colors[0]?.id)

	const handleColorSelect = (colorId: string) => {
		setSelectedId(colorId)
		onColorChange(colorId)
	}

	if (!colors.length) return null

	return (
		<div className={`flex flex-col gap-4 max-sm:gap-3 ${className}`}>
			<label className="text-base font-bold leading-[1.3125] text-[#121212] max-sm:text-sm">
				Цвет
			</label>
			<div className="flex gap-3 max-sm:gap-2 flex-wrap">
				{colors.map((color) => (
					<button
						key={color.id}
						onClick={() => handleColorSelect(color.id)}
						className={`px-4 py-2 rounded-[4px] border-2 transition-all duration-200 text-base font-normal max-sm:text-sm ${
							selectedId === color.id
								? 'border-[#7B1931] bg-[#7B1931] text-white'
								: 'border-[#A0A4A8] bg-white text-[#121212] hover:border-[#7B1931] hover:text-[#7B1931]'
						}`}
						aria-label={`Выбрать цвет ${color.name}`}
					>
						{color.name}
					</button>
				))}
			</div>
		</div>
	)
}
