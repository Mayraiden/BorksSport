'use client'

import { useState } from 'react'
import type { ProductSize } from '../types'

type SizeSelectorProps = {
	sizes: ProductSize[]
	selectedSizeId?: string
	onSizeChange: (sizeId: string) => void
	className?: string
}

export const SizeSelector = ({
	sizes,
	selectedSizeId,
	onSizeChange,
	className = '',
}: SizeSelectorProps) => {
	const [selectedId, setSelectedId] = useState(selectedSizeId || sizes[0]?.id)

	const handleSizeSelect = (sizeId: string) => {
		setSelectedId(sizeId)
		onSizeChange(sizeId)
	}

	if (!sizes.length) return null

	return (
		<div className={`flex flex-col gap-4 ${className}`}>
			<label className="text-base font-bold leading-[1.3125] text-[#121212]">
				Размер
			</label>
			<div className="flex gap-3 flex-wrap">
				{sizes.map((size) => (
					<button
						key={size.id}
						onClick={() => handleSizeSelect(size.id)}
						className={`w-[52px] h-10 flex items-center justify-center text-base font-normal leading-[1.3125] rounded-[4px] transition-colors duration-200 ${
							selectedId === size.id
								? 'bg-[#7B1931] text-[#F5F5F5]'
								: 'bg-white text-[#121212] border border-[rgba(160,164,168,0.25)] hover:bg-gray/10'
						}`}
						aria-label={`Выбрать размер ${size.value}`}
					>
						{size.value}
					</button>
				))}
			</div>
		</div>
	)
}
