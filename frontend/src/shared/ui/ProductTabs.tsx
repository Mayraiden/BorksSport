'use client'

import { useState } from 'react'
import type { Product } from '../types'

type ProductTabsProps = {
	product: Product
	className?: string
}

type TabType = 'characteristics' | 'description' | 'delivery'

export const ProductTabs = ({ product, className = '' }: ProductTabsProps) => {
	const [activeTab, setActiveTab] = useState<TabType>('characteristics')

	const tabs = [
		{ id: 'characteristics' as TabType, label: 'Характеристики' },
		{ id: 'description' as TabType, label: 'Описание' },
		{ id: 'delivery' as TabType, label: 'Доставка' },
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

				return (
					<div className="flex gap-5">
						{/* Левая колонка */}
						<div className="flex-1 flex flex-col gap-2">
							{leftColumn.map(([key, value]) => (
								<div
									key={key}
									className="flex justify-between items-center gap-5 py-2 border-b border-[#A0A4A8]"
								>
									<span className="text-base font-bold leading-[1.3125] text-[#121212]">
										{key}
									</span>
									<span className="text-base font-normal leading-[1.3125] text-[#121212]">
										{value}
									</span>
								</div>
							))}
						</div>

						{/* Правая колонка */}
						{rightColumn.length > 0 && (
							<div className="flex-1 flex flex-col gap-2">
								{rightColumn.map(([key, value]) => (
									<div
										key={key}
										className="flex justify-between items-center gap-5 py-2 border-b border-[#A0A4A8]"
									>
										<span className="text-base font-bold leading-[1.3125] text-[#121212]">
											{key}
										</span>
										<span className="text-base font-normal leading-[1.3125] text-[#121212]">
											{value}
										</span>
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
							<p className="text-base font-normal leading-[1.3125] text-[#121212]">
								{product.description}
							</p>
						) : (
							<div className="text-[#A0A4A8]">Описание не указано</div>
						)}
					</div>
				)
			case 'delivery':
				const deliveryItems =
					product.delivery && product.delivery.length > 0
						? product.delivery
						: [
								'Самовывоз по адресу: Уточнить адрес',
								'СДЭК доставка по Москве: Уточнить и прописать условия и/или стоимость',
								'СДЭК доставка в другие города: Уточнить и прописать условия и/или стоимость',
							]

				return (
					<div className="flex flex-col gap-2">
						{deliveryItems.map((item, index) => (
							<div key={index} className="flex items-start gap-2">
								<span className="text-[#7B1931] mt-1">•</span>
								<span className="text-base font-normal leading-[1.3125] text-[#121212]">
									{item}
								</span>
							</div>
						))}
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
			<div className="flex gap-5 p-5">
				{tabs.map((tab) => (
					<div key={tab.id} className="flex-1">
						<button
							onClick={() => setActiveTab(tab.id)}
							className={`w-full px-[18px] py-3 text-base font-normal leading-[1.3125] transition-colors duration-200 whitespace-nowrap rounded-[4px] ${
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
			<div className="p-5">{renderTabContent()}</div>
		</div>
	)
}
