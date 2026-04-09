'use client'

import { useState } from 'react'
import type { Product } from '../types'

type ProductTabsProps = {
	product: Product
	className?: string
}

type TabType = 'characteristics' | 'description'

export const ProductTabs = ({ product, className = '' }: ProductTabsProps) => {
	const [activeTab, setActiveTab] = useState<TabType>('characteristics')

	const renderCharacteristicValue = (key: string, value: unknown) => {
		if (key === 'Габариты' && typeof value === 'string') {
			const normalized = value.replace(/\s+/g, ' ').trim()

			const matchLength = normalized.match(/длина:\s*([\d.,]+)/i)
			const matchWidth = normalized.match(/ширина:\s*([\d.,]+)/i)
			const matchHeight = normalized.match(/высота:\s*([\d.,]+)/i)
			const matchUnit = normalized.match(/\b(мм|cm|см)\b/i)

			const toNumber = (raw: string | undefined) => {
				if (!raw) return null
				const n = Number(raw.replace(',', '.'))
				return Number.isFinite(n) ? n : null
			}

			const length = toNumber(matchLength?.[1])
			const width = toNumber(matchWidth?.[1])
			const height = toNumber(matchHeight?.[1])
			const unit = (matchUnit?.[1] || 'мм').toLowerCase().replace('cm', 'см')

			if (length || width || height) {
				return (
					<div className="flex flex-col items-end gap-2 max-sm:items-start">
						<div className="flex flex-wrap justify-end gap-2 max-sm:justify-start">
							{length ? (
								<span className="px-2.5 py-1 rounded-full bg-[#F2E8EA] text-[#121212] text-xs">
									Д {length} {unit}
								</span>
							) : null}
							{width ? (
								<span className="px-2.5 py-1 rounded-full bg-[#F2E8EA] text-[#121212] text-xs">
									Ш {width} {unit}
								</span>
							) : null}
							{height ? (
								<span className="px-2.5 py-1 rounded-full bg-[#F2E8EA] text-[#121212] text-xs">
									В {height} {unit}
								</span>
							) : null}
						</div>
					</div>
				)
			}
		}

		return (
			<span className="text-base font-normal leading-[1.3125] text-[#121212] max-sm:text-sm">
				{typeof value === 'string' || typeof value === 'number' ? value : String(value ?? '—')}
			</span>
		)
	}

	const tabs = [
		{ id: 'characteristics' as TabType, label: 'Характеристики' },
		{ id: 'description' as TabType, label: 'Описание' },
	]

	const renderTabContent = () => {
		switch (activeTab) {
			case 'characteristics':
				if (!product.characteristics) {
					return <div className="text-[#A0A4A8]">Характеристики не указаны</div>
				}

				const entries = Object.entries(product.characteristics)
				const midPoint = Math.ceil(entries.length / 2)
				const leftColumn = entries.slice(0, midPoint)
				const rightColumn = entries.slice(midPoint)

				// На мобильных показываем все в одну колонку
				return (
					<div className="flex gap-5 max-sm:flex-col max-sm:gap-0">
						{/* Левая колонка */}
						<div className="flex-1 flex flex-col gap-2">
							{leftColumn.map(([key, value]) => (
								<div
									key={key}
									className="flex justify-between items-center gap-5 py-2 border-b border-[#A0A4A8] max-sm:py-2.5"
								>
									<span className="text-base font-bold leading-[1.3125] text-[#121212] max-sm:text-sm">
										{key}
									</span>
									{renderCharacteristicValue(key, value)}
								</div>
							))}
						</div>

						{/* Правая колонка */}
						{rightColumn.length > 0 && (
							<div className="flex-1 flex flex-col gap-2 max-sm:gap-0">
								{rightColumn.map(([key, value]) => (
									<div
										key={key}
										className="flex justify-between items-center gap-5 py-2 border-b border-[#A0A4A8] max-sm:py-2.5"
									>
										<span className="text-base font-bold leading-[1.3125] text-[#121212] max-sm:text-sm">
											{key}
										</span>
										{renderCharacteristicValue(key, value)}
									</div>
								))}
							</div>
						)}
					</div>
				)
			case 'description':
				return (
					<div>
						{product.description ? (
							<p className="text-base font-normal leading-[1.3125] text-[#121212] max-sm:text-sm">
								{product.description}
							</p>
						) : (
							<div className="text-[#A0A4A8] max-sm:text-sm">
								Описание не указано
							</div>
						)}
					</div>
				)
			default:
				return null
		}
	}

	return (
		<div
			className={`w-full bg-white rounded-[4px] overflow-hidden ${className}`}
		>
			{/* Tab buttons */}
			<div className="flex gap-5 p-5 max-sm:gap-2 max-sm:p-2">
				{tabs.map((tab) => (
					<div key={tab.id} className="flex-1">
						<button
							onClick={() => setActiveTab(tab.id)}
							className={`w-full px-[18px] py-3 text-base font-normal leading-[1.3125] transition-colors duration-200 whitespace-nowrap rounded-[4px] max-sm:px-3 max-sm:py-2 max-sm:text-sm ${
								activeTab === tab.id
									? 'bg-[#7B1931] text-[#F5F5F5]'
									: 'bg-[#F2E8EA] text-[#121212] hover:bg-[#F2E8EA]/80'
							}`}
						>
							{tab.label}
						</button>
					</div>
				))}
			</div>

			{/* Tab content */}
			<div className="p-5 max-sm:p-3">{renderTabContent()}</div>
		</div>
	)
}
