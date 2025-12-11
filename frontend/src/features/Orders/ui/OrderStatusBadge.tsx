import type { OrderStatus } from '@/features/Checkout/model/types'

interface OrderStatusBadgeProps {
	status: OrderStatus
}

const STATUS_CONFIGS: Record<
	OrderStatus,
	{ label: string; className: string }
> = {
	pending: {
		label: 'В обработке',
		className: 'bg-yellow-100 text-yellow-700',
	},
	awaiting_payment: {
		label: 'Ожидает оплату',
		className: 'bg-orange-100 text-orange-700',
	},
	paid: {
		label: 'Оплачен',
		className: 'bg-green-100 text-green-700',
	},
	payment_failed: {
		label: 'Оплата не прошла',
		className: 'bg-red-100 text-red-700',
	},
	shipped: {
		label: 'Отправлен',
		className: 'bg-blue-100 text-blue-700',
	},
	delivered: {
		label: 'Доставлен',
		className: 'bg-emerald-100 text-emerald-700',
	},
	cancelled: {
		label: 'Отменён',
		className: 'bg-gray-200 text-gray-600',
	},
}

export const OrderStatusBadge = ({ status }: OrderStatusBadgeProps) => {
	const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.pending
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
		>
			{config.label}
		</span>
	)
}


