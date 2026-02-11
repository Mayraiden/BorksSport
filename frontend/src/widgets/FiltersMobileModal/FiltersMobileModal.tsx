'use client'

import { useEffect } from 'react'
import { X } from '@phosphor-icons/react/ssr'
import { Filters } from '../Filters/Filters'
import { useFilters } from '@/features/Filters/lib/hooks'

type FiltersMobileModalProps = {
	isOpen: boolean
	onClose: () => void
}

export const FiltersMobileModal = ({
	isOpen,
	onClose,
}: FiltersMobileModalProps) => {
	const { applyFilters } = useFilters()

	// Блокируем скролл body когда модалка открыта
	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden'
		} else {
			document.body.style.overflow = ''
		}

		return () => {
			document.body.style.overflow = ''
		}
	}, [isOpen])

	// Обработчик применения фильтров - закрываем модалку
	const handleApplyFilters = () => {
		applyFilters()
		onClose()
	}

	if (!isOpen) return null

	return (
		<>
			{/* Overlay */}
			<div
				className="fixed inset-0 bg-black/50 z-50 md:hidden"
				onClick={onClose}
			/>

			{/* Modal */}
			<div className="fixed inset-y-0 left-0 w-full bg-white z-50 shadow-xl md:hidden flex flex-col">
				{/* Header */}
				<div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
					<h2 className="text-lg font-bold text-gray-900">ФИЛЬТРЫ</h2>
					<button
						onClick={onClose}
						className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
						aria-label="Закрыть"
					>
						<X size={24} />
					</button>
				</div>

				{/* Filters content */}
				<div className="flex-1 overflow-y-auto min-h-0">
					<Filters isMobile={true} onApply={handleApplyFilters} />
				</div>
			</div>
		</>
	)
}

