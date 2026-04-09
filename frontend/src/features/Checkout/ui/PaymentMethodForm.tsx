'use client'

import { useEffect } from 'react'
import { SectionHeader } from '@/shared/ui/SectionHeader'
import type { DeliveryType, PaymentData, PaymentProvider } from '../model/types'

type PaymentMethodFormProps = {
	data: PaymentData
	onChange: (data: Partial<PaymentData>) => void
	deliveryType: DeliveryType
}

type OnlinePaymentProvider = 'sbp' | 'card'

const ONLINE_LABELS: Record<OnlinePaymentProvider, string> = {
	sbp: 'СБП',
	card: 'Картой',
}

const DELIVERY_LABELS: Record<'cash' | 'card', string> = {
	card: 'картой',
	cash: 'наличными',
}

type PaymentCardProps = {
	provider: OnlinePaymentProvider
	isSelected: boolean
	onSelect: () => void
}

const SelectedBadge = () => (
	<div className="absolute top-2 left-2 w-5 h-5 max-sm:w-4 max-sm:h-4 rounded-full bg-[#7B1931] flex items-center justify-center">
		<svg
			className="w-3 h-3 max-sm:w-2.5 max-sm:h-2.5 text-white"
			viewBox="0 0 12 12"
			fill="none"
		>
			<path
				d="M2 6l3 3 5-5"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	</div>
)

const PaymentCard = ({ provider, isSelected, onSelect }: PaymentCardProps) => {
	const label = ONLINE_LABELS[provider]
	return (
		<button
			type="button"
			onClick={onSelect}
			className={`relative w-[160px] max-sm:w-full h-[90px] max-sm:h-[70px] bg-gray-100 rounded-lg border transition-all ${
				isSelected
					? 'border-[#7B1931] border-2'
					: 'border-gray-200 hover:border-gray-400 hover:bg-gray-200'
			}`}
		>
			{isSelected && <SelectedBadge />}
			<div className="w-full h-full flex items-center justify-center p-3">
				<span className="text-base max-sm:text-sm font-medium text-black">
					{label}
				</span>
			</div>
		</button>
	)
}

type CashOnDeliveryCardProps = {
	method: 'cash' | 'card'
	isSelected: boolean
	onSelect: () => void
}

const CashOnDeliveryCard = ({
	method,
	isSelected,
	onSelect,
}: CashOnDeliveryCardProps) => {
	const label = DELIVERY_LABELS[method]

	return (
		<button
			type="button"
			onClick={onSelect}
			className={`relative w-[160px] max-sm:w-full h-[90px] max-sm:h-[70px] bg-gray-100 rounded-lg border transition-all ${
				isSelected
					? 'border-[#7B1931] border-2'
					: 'border-gray-200 hover:border-gray-400 hover:bg-gray-200'
			}`}
		>
			{isSelected && <SelectedBadge />}
			<div className="w-full h-full flex items-center justify-center p-3">
				<span className="text-base max-sm:text-sm font-medium text-black capitalize">
					{label}
				</span>
			</div>
		</button>
	)
}

export const PaymentMethodForm = ({
	data,
	onChange,
	deliveryType,
}: PaymentMethodFormProps) => {
	const isCashOnDeliveryAllowed = deliveryType === 'pickup'

	const handlePaymentTypeChange = (type: 'online' | 'cash_on_delivery') => {
		if (type === 'cash_on_delivery' && !isCashOnDeliveryAllowed) {
			return
		}
		if (type === 'online') {
			onChange({
				type: 'online',
				provider: 'sbp', // По умолчанию СБП
				cashOnDeliveryMethod: undefined,
			})
		} else {
			onChange({
				type: 'cash_on_delivery',
				provider: null,
				cashOnDeliveryMethod: 'cash', // По умолчанию наличные
			})
		}
	}

	const handleOnlineProviderChange = (provider: OnlinePaymentProvider) => {
		onChange({
			provider: provider as PaymentProvider,
		})
	}

	const handleCashOnDeliveryMethodChange = (method: 'cash' | 'card') => {
		onChange({
			cashOnDeliveryMethod: method,
		})
	}

	// Если выбран tochka (старый вариант), сбрасываем на sbp
	useEffect(() => {
		if (data.type === 'online' && data.provider === 'tochka') {
			onChange({
				provider: 'sbp',
			})
		}
	}, [data.type, data.provider, onChange])

	// Cash on delivery is not allowed for delivery (door/pvz).
	// If user switches from pickup → delivery, force online payment.
	useEffect(() => {
		if (!isCashOnDeliveryAllowed && data.type === 'cash_on_delivery') {
			onChange({
				type: 'online',
				provider: 'sbp',
				cashOnDeliveryMethod: undefined,
			})
		}
	}, [data.type, isCashOnDeliveryAllowed, onChange])

	return (
		<div className="bg-white rounded-md p-5 max-sm:p-4 flex flex-col gap-10 max-sm:gap-5">
			{/* Заголовок секции */}
			<SectionHeader number={3} title="Способ оплаты" />

			{/* Кнопки выбора способа оплаты */}
			<div className="flex gap-3 max-sm:gap-2">
				<button
					type="button"
					onClick={() => handlePaymentTypeChange('online')}
					className={`px-[18px] max-sm:px-4 py-3 max-sm:py-2.5 rounded-md text-xs max-sm:text-[10px] font-normal leading-[1.75] transition-colors ${
						data.type === 'online'
							? 'bg-[#7B1931] text-[#F5F5F5]'
							: 'bg-[#F2E8EA] text-black'
					}`}
				>
					Онлайн
				</button>
				<button
					type="button"
					onClick={() => handlePaymentTypeChange('cash_on_delivery')}
					disabled={!isCashOnDeliveryAllowed}
					className={`px-[18px] max-sm:px-4 py-3 max-sm:py-2.5 rounded-md text-xs max-sm:text-[10px] font-normal leading-[1.75] transition-colors ${
						data.type === 'cash_on_delivery'
							? 'bg-[#7B1931] text-[#F5F5F5]'
							: 'bg-[#F2E8EA] text-black'
					} ${!isCashOnDeliveryAllowed ? 'opacity-50 cursor-not-allowed' : ''}`}
				>
					При получении
				</button>
			</div>

			{/* Карточки выбора способа оплаты */}
			{data.type === 'online' && (
				<div className="flex gap-3 max-sm:gap-2 max-sm:flex-col">
					<PaymentCard
						provider="sbp"
						isSelected={data.provider === 'sbp'}
						onSelect={() => handleOnlineProviderChange('sbp')}
					/>
					<PaymentCard
						provider="card"
						isSelected={data.provider === 'card'}
						onSelect={() => handleOnlineProviderChange('card')}
					/>
				</div>
			)}

			{/* Карточки выбора способа оплаты при получении */}
			{data.type === 'cash_on_delivery' && (
				<div className="flex gap-3 max-sm:gap-2 max-sm:flex-col">
					<CashOnDeliveryCard
						method="card"
						isSelected={data.cashOnDeliveryMethod === 'card'}
						onSelect={() => handleCashOnDeliveryMethodChange('card')}
					/>
					<CashOnDeliveryCard
						method="cash"
						isSelected={data.cashOnDeliveryMethod === 'cash'}
						onSelect={() => handleCashOnDeliveryMethodChange('cash')}
					/>
				</div>
			)}
		</div>
	)
}
