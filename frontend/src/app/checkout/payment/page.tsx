'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { checkoutApi } from '@/features/Checkout/api/checkoutApi'
import { useAuthStore } from '@/features/Auth/model/store'
import { isEmailAuthDisabled } from '@/shared/config/emailAuth'
import type {
	PaymentSessionResponse,
	PaymentStatus,
} from '@/features/Checkout/model/types'

interface StoredPaymentSession extends PaymentSessionResponse {
	orderNumber?: string
	totalAmount?: number
	timestamp?: number
	openedAt?: number
}

const formatCurrency = (amount?: number) => {
	if (typeof amount !== 'number' || Number.isNaN(amount)) {
		return '—'
	}

	return new Intl.NumberFormat('ru-RU', {
		style: 'currency',
		currency: 'RUB',
		maximumFractionDigits: 2,
	}).format(amount)
}

const PAYMENT_SESSION_PREFIX = 'sportmag.payment.session.'

const PaymentPageContent = () => {
	const searchParams = useSearchParams()
	const router = useRouter()
	const { jwt, isAuthenticated } = useAuthStore()
	const isEmailConfirmed = useAuthStore((state) =>
		isEmailAuthDisabled() ? true : !!state.user?.confirmed
	)

	const orderIdParam = searchParams.get('orderId')
	const paymentIdParam = searchParams.get('paymentId')

	const orderId = orderIdParam ? Number(orderIdParam) : undefined
	const paymentId = paymentIdParam ? Number(paymentIdParam) : undefined

	const [session, setSession] = useState<StoredPaymentSession | null>(null)
	const [status, setStatus] = useState<PaymentStatus>('pending')
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [hasTriedAutoOpen, setHasTriedAutoOpen] = useState(false)

	const storageKey = useMemo(() => {
		return paymentId ? `${PAYMENT_SESSION_PREFIX}${paymentId}` : null
	}, [paymentId])

	useEffect(() => {
		if (!storageKey) {
			return
		}

		if (typeof window === 'undefined') {
			return
		}

		try {
			const raw = sessionStorage.getItem(storageKey)
			if (raw) {
				const parsed: StoredPaymentSession = JSON.parse(raw)
				setSession(parsed)
				if (parsed.status) {
					setStatus(
						(parsed.status as PaymentStatus) || ('pending' as PaymentStatus)
					)
				}
			}
		} catch (storageError) {
			console.warn('Unable to restore payment session', storageError)
		}
	}, [storageKey])

	const persistSession = useCallback(
		(next: StoredPaymentSession) => {
			if (!storageKey || typeof window === 'undefined') {
				return
			}

			try {
				sessionStorage.setItem(storageKey, JSON.stringify(next))
			} catch (storageError) {
				console.warn('Unable to persist payment session', storageError)
			}
		},
		[storageKey]
	)

	const refreshStatus = useCallback(async () => {
		if (!paymentId || !jwt) {
			if (!jwt) {
				setError('Для проверки статуса нужно войти в аккаунт.')
			}
			return
		}
		if (!isEmailConfirmed) {
			setError('Подтвердите email, чтобы пользоваться оплатой.')
			return
		}

		try {
			setIsRefreshing(true)
			const result = await checkoutApi.getTochkaPaymentStatus(paymentId, jwt)
			setStatus(result.status)
			setError(null)

			setSession((prev) => {
				if (!prev) {
					return prev
				}

				if (prev.status === result.status) {
					return prev
				}

				const nextSession: StoredPaymentSession = {
					...prev,
					status: result.status,
				}
				persistSession(nextSession)
				return nextSession
			})
		} catch (statusError: unknown) {
			console.error('Unable to refresh payment статус', statusError)
			const errorMessage =
				statusError instanceof Error
					? statusError.message
					: 'Не удалось обновить статус платежа.'
			setError(errorMessage)
		} finally {
			setIsRefreshing(false)
		}
	}, [isEmailConfirmed, jwt, paymentId, persistSession])

	useEffect(() => {
		if (!isAuthenticated || !paymentId) {
			return
		}

		if (status === 'pending') {
			refreshStatus()
			const interval = setInterval(() => {
				refreshStatus()
			}, 15000)

			return () => clearInterval(interval)
		}
	}, [isAuthenticated, paymentId, refreshStatus, status])

	useEffect(() => {
		if (status === 'paid' && orderId) {
			// После подтверждения оплаты перенаправляем пользователя в заказ
			const timeout = setTimeout(() => {
				router.replace(`/orders/${orderId}?status=paid`)
			}, 2000)

			return () => clearTimeout(timeout)
		}
	}, [status, orderId, router])

	useEffect(() => {
		if (
			!session ||
			!session.paymentUrl ||
			status !== 'pending' ||
			hasTriedAutoOpen
		) {
			return
		}

		setHasTriedAutoOpen(true)

		const nextSession: StoredPaymentSession = {
			...session,
			openedAt: session.openedAt ?? Date.now(),
		}
		setSession(nextSession)
		persistSession(nextSession)

		const timeout = setTimeout(() => {
			if (typeof window !== 'undefined') {
				window.location.href = session.paymentUrl as string
			}
		}, 300)

		return () => clearTimeout(timeout)
	}, [session, status, persistSession, hasTriedAutoOpen])

	const handleOpenPayment = () => {
		if (!session?.paymentUrl) {
			return
		}

		const nextSession: StoredPaymentSession = {
			...session,
			openedAt: Date.now(),
		}
		setSession(nextSession)
		persistSession(nextSession)

		window.location.href = session.paymentUrl
	}

	if (!orderId || !paymentId) {
		return (
			<div className="max-w-3xl max-sm:max-w-full mx-auto mt-10 max-sm:mt-4 bg-white rounded-md p-6 max-sm:p-4">
				<h1 className="text-2xl max-sm:text-xl font-bold text-black mb-4 max-sm:mb-3">
					Не удалось определить данные платежа
				</h1>
				<p className="text-base max-sm:text-sm text-gray-600">
					Проверьте ссылку или вернитесь в{' '}
					<Link className="text-blue underline" href="/cart">
						корзину
					</Link>
					.
				</p>
			</div>
		)
	}

	return (
		<div className="max-w-3xl max-sm:max-w-full mx-auto mt-10 max-sm:mt-4 bg-white rounded-md p-6 max-sm:p-4 shadow-sm">
			<div className="flex flex-col gap-4 max-sm:gap-3">
				<h1 className="text-2xl max-sm:text-xl font-bold text-black">
					Оплата заказа №{session?.orderNumber || orderId}
				</h1>
				<p className="text-sm max-sm:text-xs text-gray-500">
					Пожалуйста, завершите оплату. После успешной оплаты мы автоматически
					перенаправим вас в детали заказа.
				</p>

				<div className="bg-gray-50 border border-gray-200 rounded-md p-4 max-sm:p-3 flex flex-col gap-2 max-sm:gap-1.5">
					<div className="flex justify-between text-sm max-sm:text-xs text-gray-700">
						<span>Сумма к оплате</span>
						<span className="font-semibold text-black">
							{formatCurrency(session?.totalAmount)}
						</span>
					</div>
					<div className="flex justify-between text-sm max-sm:text-xs text-gray-700">
						<span>Статус</span>
						<span
							className={`font-semibold ${
								status === 'paid'
									? 'text-green-600'
									: status === 'failed'
										? 'text-red-600'
										: 'text-yellow-600'
							}`}
						>
							{status === 'paid'
								? 'Оплачено'
								: status === 'failed'
									? 'Оплата не прошла'
									: 'Ожидает оплаты'}
						</span>
					</div>
					{error && <p className="text-sm max-sm:text-xs text-red-600">{error}</p>}
				</div>

				{status === 'pending' && (
					<div className="flex flex-col md:flex-row gap-3 max-sm:gap-2 mt-4 max-sm:mt-3">
						<button
							type="button"
							onClick={handleOpenPayment}
							disabled={!session?.paymentUrl || !isEmailConfirmed}
							className={`flex-1 py-3 max-sm:py-2.5 px-4 max-sm:px-3 rounded-md text-white text-sm max-sm:text-xs transition-colors ${
								session?.paymentUrl && isEmailConfirmed
									? 'bg-[#7B1931] hover:bg-[#6a1529]'
									: 'bg-gray-300 cursor-not-allowed'
							}`}
						>
							Перейти к оплате
						</button>
						<button
							type="button"
							onClick={refreshStatus}
							disabled={isRefreshing || !isAuthenticated || !isEmailConfirmed}
							className={`flex-1 py-3 max-sm:py-2.5 px-4 max-sm:px-3 rounded-md text-sm max-sm:text-xs transition-colors border ${
								isRefreshing
									? 'border-gray-200 text-gray-400 bg-gray-100 cursor-wait'
									: 'border-[#7B1931] text-[#7B1931] hover:bg-[#f8f0f2]'
							}`}
						>
							{isRefreshing ? 'Обновление...' : 'Проверить статус'}
						</button>
					</div>
				)}

				{!isEmailConfirmed && (
					<div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 max-sm:p-3 rounded-md text-sm max-sm:text-xs">
						Подтвердите email, чтобы продолжить оплату.
						<div className="mt-2">
							<Link className="underline" href="/auth/confirm-email">
								Перейти к подтверждению email
							</Link>
						</div>
					</div>
				)}

				{status === 'failed' && (
					<div className="mt-4 max-sm:mt-3 bg-red-50 border border-red-200 text-red-700 p-4 max-sm:p-3 rounded-md text-sm max-sm:text-xs">
						<p className="font-semibold">Оплата не прошла.</p>
						<p className="mt-1 max-sm:mt-0.5">
							Попробуйте запустить оплату ещё раз или выберите другой способ
							получения заказа.
						</p>
					</div>
				)}

				<div className="mt-6 max-sm:mt-4 flex flex-col md:flex-row gap-3 max-sm:gap-2 text-sm max-sm:text-xs">
					<Link
						className="flex-1 text-center py-3 max-sm:py-2.5 px-4 max-sm:px-3 rounded-md border border-gray-200 hover:bg-gray-50"
						href="/cart"
					>
						Вернуться в корзину
					</Link>
					<Link
						className="flex-1 text-center py-3 max-sm:py-2.5 px-4 max-sm:px-3 rounded-md border border-gray-200 hover:bg-gray-50"
						href={`/orders/${orderId}`}
					>
						К деталям заказа
					</Link>
				</div>
			</div>
		</div>
	)
}

const PaymentPage = () => {
	return (
		<Suspense fallback={<div className="max-w-3xl max-sm:max-w-full mx-auto mt-10 max-sm:mt-4 bg-white rounded-md p-6 max-sm:p-4">Загрузка...</div>}>
			<PaymentPageContent />
		</Suspense>
	)
}

export default PaymentPage
