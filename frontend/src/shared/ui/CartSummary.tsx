'use client'

import type { CartItemDisplay } from '@/features/Cart/api/cartApi'

type CartSummaryProps = {
	cartItems: CartItemDisplay[]
	className?: string
	onCheckout?: () => void
	deliveryCost?: number // Стоимость доставки (опционально)
	hideCheckoutButton?: boolean // Скрыть кнопку оформления (для страницы checkout)
}

export const CartSummary = ({
	cartItems,
	className = '',
	onCheckout,
	deliveryCost = 0,
	hideCheckoutButton = false,
}: CartSummaryProps) => {
	// Вычисляем итоги
	const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0)

	// Сумма заказа (без скидки)
	const orderTotal = cartItems.reduce(
		(sum, item) => sum + item.product.price * item.quantity,
		0
	)

	// TODO: Когда будет доступна информация о скидках, использовать её
	// Пока скидка = 0
	const discount = 0
	const discountAmount = (orderTotal * discount) / 100

	// Итоговая сумма (с учетом доставки)
	const total = orderTotal - discountAmount + deliveryCost

	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('ru-RU').format(price) + ' руб'
	}

	return (
		<div
			className={`flex flex-col gap-3 bg-white rounded-[4px] p-5 ${className}`}
		>
			{/* Заголовок */}
			<h2 className="text-xl font-bold leading-[1.05] text-[#000000]">
				Ваша корзина:
			</h2>

			{/* Сводка */}
			<div className="flex flex-col gap-3">
				{/* Количество товаров */}
				<div className="flex justify-between items-center">
					<span className="text-base font-normal leading-[1.3125] text-[#000000]">
						Количество товаров:
					</span>
					<span className="text-base font-bold leading-[1.3125] text-[#000000] text-right">
						{totalQuantity} шт.
					</span>
				</div>

				{/* Сумма заказа */}
				<div className="flex justify-between items-center">
					<span className="text-base font-normal leading-[1.3125] text-[#000000]">
						Сумма заказа:
					</span>
					<span className="text-base font-bold leading-[1.3125] text-[#000000] text-right">
						{formatPrice(orderTotal)}
					</span>
				</div>

				{/* Скидка (показываем только если есть) */}
				{discountAmount > 0 && (
					<div className="flex justify-between items-center">
						<span className="text-base font-normal leading-[1.3125] text-[#000000]">
							Скидка:
						</span>
						<span className="text-base font-bold leading-[1.3125] text-[#E76F51] text-right">
							- {formatPrice(discountAmount)}
						</span>
					</div>
				)}

				{/* Доставка (показываем только если есть стоимость) */}
				{deliveryCost > 0 && (
					<div className="flex justify-between items-center">
						<span className="text-base font-normal leading-[1.3125] text-[#000000]">
							Доставка:
						</span>
						<span className="text-base font-bold leading-[1.3125] text-[#000000] text-right">
							{formatPrice(deliveryCost)}
						</span>
					</div>
				)}
			</div>

			{/* Разделитель */}
			<div className="w-full h-[2px] bg-[#F0F4F8] my-2" />

			{/* Итого */}
			<div className="flex justify-between items-center">
				<span className="text-base font-bold leading-[1.3125] text-[#000000]">
					Итого:
				</span>
				<span className="text-base font-bold leading-[1.3125] text-[#2A7D5A] text-right">
					{formatPrice(total)}
				</span>
			</div>

			{/* Кнопка оформления (скрыта на странице checkout) */}
			{!hideCheckoutButton && (
				<button
					onClick={onCheckout}
					disabled={cartItems.length === 0}
					className="w-full h-[56px] flex items-center justify-center bg-[#7B1931] text-[#F5F5F5] rounded-[4px] hover:bg-[#6a1529] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-4"
				>
					<span className="text-base font-normal leading-[1.3125]">
						Перейти к оформлению
					</span>
				</button>
			)}

			{/* Информационный текст */}
			<p className="text-xs font-normal leading-[1.4] text-[#A0A4A8] mt-2">
				Доступные способы оплаты и доставки можно выбрать при оформлении заказа
			</p>
		</div>
	)
}
