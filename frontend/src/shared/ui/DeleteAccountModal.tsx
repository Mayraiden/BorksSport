'use client'

import Image from 'next/image'

interface DeleteAccountModalProps {
	isOpen: boolean
	onClose: () => void
	onConfirm: () => void
	isLoading?: boolean
}

export const DeleteAccountModal = ({
	isOpen,
	onClose,
	onConfirm,
	isLoading = false,
}: DeleteAccountModalProps) => {
	if (!isOpen) return null

	const handleConfirm = () => {
		onConfirm()
	}

	return (
		<>
			{/* Overlay для закрытия по клику вне модала */}
			<div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

			{/* Модальное окно */}
			<div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
				<div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 relative pointer-events-auto">
					{/* Header */}
					<div className="flex items-center justify-center mb-4">
						<div className="flex items-center gap-2">
							<Image src="/logo.svg" alt="logo" width={140} height={120} />
						</div>
					</div>

					{/* Title */}
					<h2 className="text-2xl font-bold text-black mb-3 text-center">
						Удаление аккаунта
					</h2>

					{/* Warning */}
					<div className="mb-6">
						<p className="text-red-600 font-semibold mb-2 text-center">
							Внимание! Это действие необратимо.
						</p>
						<p className="text-gray-700 text-sm leading-relaxed text-center mb-4">
							При удалении аккаунта будут безвозвратно удалены:
						</p>
						<ul className="text-gray-600 text-sm space-y-1 mb-4 list-disc list-inside">
							<li>Все ваши заказы</li>
							<li>Сохраненные адреса доставки</li>
							<li>Товары в корзине</li>
							<li>Избранные товары</li>
							<li>Персональные данные</li>
						</ul>
						<p className="text-gray-700 text-sm leading-relaxed text-center">
							Вы уверены, что хотите удалить свой аккаунт?
						</p>
					</div>

					{/* Buttons */}
					<div className="space-y-3">
						<button
							onClick={handleConfirm}
							disabled={isLoading}
							className="w-full bg-[#7B1931] hover:bg-[#6a1529] text-white font-medium py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isLoading ? 'Удаление...' : 'Да, удалить аккаунт'}
						</button>
						<button
							onClick={onClose}
							disabled={isLoading}
							className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Отмена
						</button>
					</div>
				</div>
			</div>
		</>
	)
}

