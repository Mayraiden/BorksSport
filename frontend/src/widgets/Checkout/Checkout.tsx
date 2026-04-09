'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CustomerDataForm } from '@/features/Checkout/ui/CustomerDataForm'
import { DeliveryMethodForm } from '@/features/Checkout/ui/DeliveryMethodForm'
import { PaymentMethodForm } from '@/features/Checkout/ui/PaymentMethodForm'
import { Checkbox } from '@/shared/ui/Checkbox'
import { CartSummary } from '@/shared/ui/CartSummary'
import { checkoutApi } from '@/features/Checkout/api/checkoutApi'
import { validateCheckoutForm, hasErrors } from '@/features/Checkout/lib/validation'
import { useAuthStore } from '@/features/Auth/model/store'
import { cartApi, type CartItemDisplay } from '@/features/Cart/api/cartApi'
import { refreshCartCount } from '@/features/Cart/lib/useCartCount'
import type {
	CheckoutFormData,
	CheckoutFormErrors,
	DeliveryData,
	CustomerData,
	PaymentData,
	PaymentSessionResponse,
} from '@/features/Checkout/model/types'

export const Checkout = () => {
	const router = useRouter()
	const { isAuthenticated, jwt, user } = useAuthStore()
	// Email confirmation is currently disabled in product UX.
	// Keep the flag for future, but never block checkout.
	const isEmailConfirmed = true
	const [cartItems, setCartItems] = useState<CartItemDisplay[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errors, setErrors] = useState<CheckoutFormErrors>({})

	// Инициализация формы данными пользователя (если авторизован)
	const [formData, setFormData] = useState<CheckoutFormData>({
		customer: {
			name: '',
			phone: '',
			email: '',
		},
		delivery: {
			type: 'pickup',
			address: {
				type: 'pickup',
				pickupAddress: {
					address: 'Москва, Волгоградский проспект, дом 111',
					workingHours: 'Ежедневно с 9:00 до 21:00',
				},
			},
		},
		payment: {
			type: 'online',
			provider: 'sbp',
			cashOnDeliveryMethod: undefined,
		},
		agreements: {
			publicOffer: false,
			personalData: false,
		},
	})

	// Загрузка корзины и заполнение данных пользователя
	useEffect(() => {
		const loadData = async () => {
			if (!isAuthenticated || !jwt) {
				setIsLoading(false)
				return
			}

			try {
				// Загружаем корзину
				const items = await cartApi.getCart(jwt)
				setCartItems(items)

				// Заполняем данные пользователя
				if (user) {
					setFormData((prev) => ({
						...prev,
						customer: {
							name:
								user.firstName && user.lastName
									? `${user.lastName} ${user.firstName}`
									: user.username || '',
							phone: user.phone || '',
							email: user.email || '',
						},
					}))
				}
			} catch (error) {
				console.error('Failed to load checkout data:', error)
			} finally {
				setIsLoading(false)
			}
		}

		loadData()
	}, [isAuthenticated, jwt, user])

	// Обработчики изменений формы
	const handleCustomerChange = (data: Partial<CustomerData>) => {
		setFormData((prev) => ({
			...prev,
			customer: { ...prev.customer, ...data },
		}))
		setErrors((prev) => ({
			...prev,
			customer: undefined,
		}))
	}

	const handleDeliveryChange = (data: Partial<DeliveryData>) => {
		setFormData((prev) => ({
			...prev,
			delivery: { ...prev.delivery, ...data },
		}))
		setErrors((prev) => ({
			...prev,
			delivery: undefined,
		}))
	}

	const handlePaymentChange = (data: Partial<PaymentData>) => {
		setFormData((prev) => ({
			...prev,
			payment: { ...prev.payment, ...data },
		}))
	}

	const handleAgreementChange = (
		field: 'publicOffer' | 'personalData',
		value: boolean
	) => {
		setFormData((prev) => ({
			...prev,
			agreements: {
				...prev.agreements,
				[field]: value,
			},
		}))
		setErrors((prev) => ({
			...prev,
			agreements: {
				...prev.agreements,
				[field]: undefined,
			},
		}))
	}

	// Обработка отправки формы
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (!isAuthenticated || !jwt) {
			router.push('/auth')
			return
		}

		if (cartItems.length === 0) {
			setErrors({
				general: 'Корзина пуста. Добавьте товары для оформления заказа.',
			})
			return
		}

		// Валидация
		const validationErrors = validateCheckoutForm(formData)
		setErrors(validationErrors)

		if (hasErrors(validationErrors)) {
			return
		}

		setIsSubmitting(true)

		try {
			// Создаем заказ
			const order = await checkoutApi.createOrder(formData, cartItems, jwt)

			// Очищаем корзину после успешного создания заказа
			try {
				await cartApi.clearCart(jwt)
				setCartItems([])
				await refreshCartCount(jwt)
			} catch (clearError) {
				console.warn('Unable to clear cart after order creation', clearError)
			}

			if (formData.payment.type === 'online' && formData.payment.provider) {
				let paymentSession: PaymentSessionResponse | null = null
				try {
					paymentSession = await checkoutApi.createTochkaPaymentSession(
						order.id,
						jwt
					)
				} catch (paymentError: unknown) {
					console.error('Failed to create payment session:', paymentError)
					const errorMessage = paymentError instanceof Error ? paymentError.message : 'Не удалось инициировать оплату. Попробуйте позже или выберите другой способ оплаты.'
					setErrors({
						general: errorMessage || 'Не удалось инициировать оплату. Попробуйте позже или выберите другой способ оплаты.',
					})
					return
				}

				if (typeof window !== 'undefined') {
					try {
						sessionStorage.setItem(
							`sportmag.payment.session.${paymentSession.paymentId}`,
							JSON.stringify({
								...paymentSession,
								orderId: order.id,
								orderNumber: order.orderNumber,
								totalAmount: order.totalAmount,
								timestamp: Date.now(),
							})
						)
					} catch (storageError) {
						console.warn('Unable to persist payment session in sessionStorage', storageError)
					}
				}

				// Переходим на страницу оплаты, где покажем статус и при необходимости редиректим
				router.push(
					`/checkout/payment?orderId=${order.id}&paymentId=${paymentSession.paymentId}`
				)
			} else {
				// При самовывозе или оплате при получении просто редиректим на страницу заказа
				router.push(`/orders/${order.id}?status=${order.status}`)
			}
		} catch (error: unknown) {
			console.error('Failed to create order:', error)
			const errorMessage = error instanceof Error ? error.message : 'Не удалось создать заказ. Попробуйте позже.'
			setErrors({
				general: errorMessage,
			})
		} finally {
			setIsSubmitting(false)
		}
	}

	// Расчет итогов (переменные закомментированы, т.к. используются в CartSummary)
	// const orderTotal = cartItems.reduce(
	// 	(sum, item) => sum + item.product.price * item.quantity,
	// 	0
	// )
	// const discount = 0 // TODO: Добавить расчет скидок
	// const discountAmount = (orderTotal * discount) / 100
	// const deliveryCost =
	// 	formData.delivery.type === 'delivery'
	// 		? formData.delivery.deliveryCost || 990
	// 		: 0
	// const orderTotalWithDelivery = orderTotal - discountAmount + deliveryCost

	if (!isAuthenticated) {
		return (
			<div className="bg-white rounded-md p-5 max-sm:p-4 flex flex-col items-center gap-5 max-sm:gap-3">
				<h2 className="text-xl font-bold max-sm:text-lg">Необходимо войти в аккаунт</h2>
				<p className="text-base text-center max-sm:text-sm">
					Войдите в аккаунт для оформления заказа.
				</p>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="bg-white rounded-md p-5 max-sm:p-4 flex items-center justify-center">
				<span className="text-base max-sm:text-sm text-gray-400">Загрузка...</span>
			</div>
		)
	}

	if (cartItems.length === 0) {
		return (
			<div className="bg-white rounded-md p-5 max-sm:p-4 flex flex-col items-center gap-5 max-sm:gap-3">
				<h2 className="text-xl font-bold max-sm:text-lg">Корзина пуста</h2>
				<p className="text-base text-center max-sm:text-sm">
					Добавьте товары в корзину для оформления заказа.
				</p>
			</div>
		)
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-5 max-sm:gap-3">
			{/* Заголовок */}
			<h1 className="text-2xl font-bold leading-[0.875] text-black max-sm:text-xl">
				Оформление заказа
			</h1>

			{/* Основной контент: форма слева, корзина справа */}
			<div className="flex flex-col lg:flex-row gap-5 max-sm:gap-3">
				{/* Левая колонка: форма */}
				<div className="flex-1 flex flex-col gap-5 max-sm:gap-3">
					{/* Общая ошибка */}
					{errors.general && (
						<div className="bg-red-50 border border-red-200 rounded-md p-4 max-sm:p-3 text-red-700 max-sm:text-sm">
							{errors.general}
						</div>
					)}

					{!isEmailConfirmed && (
						<div className="bg-yellow-50 border border-yellow-300 rounded-md p-4 max-sm:p-3 text-yellow-800 max-sm:text-sm">
							Подтвердите email, чтобы оформить заказ и оплату.
							<div className="mt-2">
								<button
									type="button"
									className="text-sm underline"
									onClick={() =>
										router.push(`/auth/confirm-email?email=${encodeURIComponent(user?.email || '')}`)
									}
								>
									Открыть подтверждение email
								</button>
							</div>
						</div>
					)}

					{/* Данные покупателя */}
					<CustomerDataForm
						data={formData.customer}
						errors={errors.customer}
						onChange={handleCustomerChange}
					/>

					{/* Способ получения */}
					<DeliveryMethodForm
						data={formData.delivery}
						items={cartItems.map((item) => ({
							productId: item.product.id,
							quantity: item.quantity,
							price: item.product.price,
						}))}
						cartItems={cartItems}
						errors={errors.delivery}
						onChange={handleDeliveryChange}
					/>

					{/* Способ оплаты */}
					<PaymentMethodForm
						data={formData.payment}
						deliveryType={formData.delivery.type}
						onChange={handlePaymentChange}
					/>

					{/* Согласия и кнопка подтверждения */}
					<div className="bg-white rounded-md p-5 max-sm:p-4 flex flex-col gap-5 max-sm:gap-3">
						{/* Чекбоксы согласий */}
						<div className="flex flex-col gap-3 max-sm:gap-2">
							<Checkbox
								checked={formData.agreements.publicOffer}
								onChange={(checked) =>
									handleAgreementChange('publicOffer', checked)
								}
							>
								<span className="text-xs leading-[1.333] max-sm:text-[10px]">
									Я согласен(-на) с условиями{' '}
									<a
										href="/public-offer"
										className="text-blue underline"
										target="_blank"
									>
										Публичной оферты
									</a>{' '}
									и{' '}
									<a
										href="/user-agreement"
										className="text-blue underline"
										target="_blank"
									>
										Пользовательским соглашением
									</a>
								</span>
							</Checkbox>

							<Checkbox
								checked={formData.agreements.personalData}
								onChange={(checked) =>
									handleAgreementChange('personalData', checked)
								}
							>
								<span className="text-xs leading-[1.333] max-sm:text-[10px]">
									Я ознакомлен с условиями и даю согласие на обработку
									Персональных данных
								</span>
							</Checkbox>
						</div>

						{/* Кнопка подтверждения */}
						<button
							type="submit"
							disabled={isSubmitting}
							className={`w-full py-4 max-sm:py-3 px-6 max-sm:px-4 rounded-md text-base max-sm:text-sm font-normal leading-[1.3125] transition-colors ${
								isSubmitting
									? 'bg-gray-300 text-gray-500 cursor-not-allowed'
									: 'bg-[#7B1931] text-[#F5F5F5] hover:bg-[#6a1529]'
							}`}
						>
							{isSubmitting ? 'Обработка...' : 'Подтвердить заказ'}
						</button>

						{formData.payment.type === 'online' && (
							<p className="text-xs max-sm:text-[10px] text-gray-600 mt-2">
								Заказ будет автоматически отменён, если не оплатить в течение 30 минут.
							</p>
						)}
					</div>
				</div>

				{/* Правая колонка: корзина */}
				<div className="w-full lg:w-[440px] lg:flex-shrink-0">
					<CartSummary
						cartItems={cartItems}
						onCheckout={() => {}} // Не нужна кнопка в корзине на странице checkout
						deliveryCost={
							formData.delivery.type === 'delivery'
								? formData.delivery.deliveryCost ?? 0
								: 0
						}
						hideCheckoutButton={true}
					/>
				</div>
			</div>
		</form>
	)
}

