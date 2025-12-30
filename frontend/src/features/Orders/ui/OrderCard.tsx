'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { OrderStatusBadge } from './OrderStatusBadge'
import type { OrderEntity } from '../model/types'

interface OrderCardProps {
	order: OrderEntity
}

const formatCurrency = (amount: number) =>
	new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 2,
	}).format(amount)

const formatDate = (isoDate: string) => {
	const date = new Date(isoDate)
	return date.toLocaleDateString('ru-RU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	})
}

export const OrderCard = ({ order }: OrderCardProps) => {
	const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)
	const deliveryCost = order.cdekDeliveryCost
	const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

	const handleImageError = (imageUrl: string) => {
		setImageErrors((prev) => new Set(prev).add(imageUrl))
	}

	return (
		<div className="bg-white rounded-md shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
				<div>
					<p className="text-sm text-gray-500">
						Заказ №{order.orderNumber} от {formatDate(order.createdAt)}
					</p>
					<p className="text-xs text-gray-400">
						Количество товаров: {totalItems} шт.
					</p>
				</div>
				<OrderStatusBadge status={order.status} />
			</div>

			<div className="flex flex-col gap-3">
				{order.items.slice(0, 3).map((item) => {
					const hasError = item.image ? imageErrors.has(item.image) : true
					const isSbisImage = 
						item.image?.includes('api.sbis.ru') || 
						item.image?.includes('disk.sbis.ru') ||
						item.image?.startsWith('/img?params=')
					const imageSrc = item.image && !hasError ? item.image : '/NoProductImage.jpg'

					return (
						<div key={`${order.id}-${item.productId}`} className="flex gap-4 items-center">
							<div className="w-14 h-14 bg-gray-100 rounded-md flex items-center justify-center overflow-hidden">
								{item.image ? (
									<Image
										src={imageSrc}
										alt={item.name}
										width={56}
										height={56}
										className="object-cover w-full h-full"
										unoptimized={isSbisImage} // Отключаем оптимизацию для api.sbis.ru чтобы избежать 404 ошибок
										onError={() => item.image && handleImageError(item.image)}
									/>
								) : (
									<span className="text-xs text-gray-400">Нет фото</span>
								)}
							</div>
						<div className="flex-1 flex flex-col gap-1">
							<p className="text-sm text-black font-medium line-clamp-2">
								{item.name}
							</p>
							<p className="text-xs text-gray-500">
								{item.quantity} × {formatCurrency(item.price)}
							</p>
						</div>
							<p className="text-sm font-semibold text-black">
								{formatCurrency(item.subtotal)}
							</p>
						</div>
					)
				})}

				{order.items.length > 3 && (
					<p className="text-xs text-gray-400">
						И ещё {order.items.length - 3} товар(ов)
					</p>
				)}
			</div>

			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-3 border-t border-gray-100">
				<div className="flex flex-col gap-1 text-sm text-gray-600">
					<span>Сумма заказа: {formatCurrency(order.totalAmount)}</span>
					{typeof deliveryCost === 'number' && !Number.isNaN(deliveryCost) && (
						<span>Доставка: {formatCurrency(deliveryCost)}</span>
					)}
					{order.paymentMethod === 'online' && (
						<span className="text-xs text-gray-400">
							Оплата: {order.paymentProvider === 'tochka' ? 'Точка банк' : 'Онлайн'}
						</span>
					)}
				</div>
				<Link
					href={`/orders/${order.id}`}
					className="inline-flex items-center justify-center px-4 py-2 text-sm text-[#7B1931] border border-[#7B1931] rounded-md hover:bg-[#f8f0f2] transition-colors"
				>
					Подробнее
				</Link>
			</div>
		</div>
	)
}


