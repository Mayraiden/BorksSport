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
		<div className={`flex flex-col gap-4 ${className}`}>
			<label className="text-base font-bold leading-[1.3125] text-[#121212]">
				Цвет
			</label>
			<div className="flex gap-3">
				{colors.map((color) => (
					<button
						key={color.id}
						onClick={() => handleColorSelect(color.id)}
						className={`w-[60px] h-[60px] rounded-[4px] border-2 transition-all duration-200 ${
							selectedId === color.id
								? 'border-[#7B1931]'
								: 'border-transparent hover:border-gray/30'
						}`}
						style={{ backgroundColor: color.hex }}
						title={color.name}
						aria-label={`Выбрать цвет ${color.name}`}
					/>
				))}
			</div>
		</div>
	)
}
