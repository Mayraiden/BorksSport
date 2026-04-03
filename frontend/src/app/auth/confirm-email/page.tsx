'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { strapiAuth } from '@/features/Auth/model/api'
import { isEmailAuthDisabled } from '@/shared/config/emailAuth'

const RESEND_COOLDOWN_SECONDS = 60

export default function ConfirmEmailPage() {
	return (
		<Suspense
			fallback={
				<section className="w-screen min-h-screen bg-[#F0F4F8] py-8 px-20 max-sm:px-2 max-sm:py-4">
					<div className="max-w-xl mx-auto bg-white rounded-md p-6 max-sm:p-4 flex flex-col gap-4">
						<h1 className="text-2xl max-sm:text-xl font-bold">Подтверждение email</h1>
						<p className="text-sm text-gray-600">Загрузка...</p>
					</div>
				</section>
			}
		>
			<ConfirmEmailPageContent />
		</Suspense>
	)
}

function ConfirmEmailPageContent() {
	const searchParams = useSearchParams()
	const email = searchParams.get('email') || ''
	const confirmationToken = searchParams.get('confirmation')
	const status = searchParams.get('status')

	const [isConfirming, setIsConfirming] = useState(false)
	const [isResending, setIsResending] = useState(false)
	const [confirmResult, setConfirmResult] = useState<string | null>(
		status === 'success' ? 'Email успешно подтвержден. Теперь доступны оформление заказа и оплата.' : null
	)
	const [error, setError] = useState<string | null>(null)
	const [cooldown, setCooldown] = useState(0)

	useEffect(() => {
		if (isEmailAuthDisabled()) return
		if (!confirmationToken) return

		const runConfirm = async () => {
			setIsConfirming(true)
			setError(null)
			try {
				const result = await strapiAuth.confirmEmail(confirmationToken)
				setConfirmResult(result.message || 'Email подтвержден')
			} catch (err) {
				const message = err instanceof Error ? err.message : 'Не удалось подтвердить email'
				setError(message)
			} finally {
				setIsConfirming(false)
			}
		}

		void runConfirm()
	}, [confirmationToken])

	useEffect(() => {
		if (cooldown <= 0) return
		const timer = setInterval(() => {
			setCooldown((prev) => (prev > 0 ? prev - 1 : 0))
		}, 1000)
		return () => clearInterval(timer)
	}, [cooldown])

	const canResend = useMemo(() => Boolean(email) && cooldown === 0 && !isResending, [email, cooldown, isResending])

	const handleResend = async () => {
		if (isEmailAuthDisabled()) return
		if (!email || !canResend) return
		setIsResending(true)
		setError(null)
		try {
			const result = await strapiAuth.resendConfirmationEmail(email)
			setConfirmResult(result.message || 'Письмо подтверждения отправлено')
			setCooldown(RESEND_COOLDOWN_SECONDS)
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Не удалось отправить письмо подтверждения'
			setError(message)
		} finally {
			setIsResending(false)
		}
	}

	return (
		<section className="w-screen min-h-screen bg-[#F0F4F8] py-8 px-20 max-sm:px-2 max-sm:py-4">
			<div className="max-w-xl mx-auto bg-white rounded-md p-6 max-sm:p-4 flex flex-col gap-4">
				<h1 className="text-2xl max-sm:text-xl font-bold">Подтверждение email</h1>
				{isEmailAuthDisabled() ? (
					<p className="text-sm text-gray-700">
						Подтверждение email временно отключено. Оформление заказа и оплата доступны без него.
					</p>
				) : (
					<p className="text-sm text-gray-700">
						Подтвердите email, чтобы разблокировать оформление заказа и оплату.
					</p>
				)}

				{email && (
					<p className="text-sm text-black">
						Почта: <span className="font-medium">{email}</span>
					</p>
				)}

				{isConfirming && <p className="text-sm text-gray-600">Проверяем токен подтверждения...</p>}
				{confirmResult && <p className="text-sm text-green-700">{confirmResult}</p>}
				{error && <p className="text-sm text-red-600">{error}</p>}

				<div className="flex flex-col sm:flex-row gap-3">
					{!isEmailAuthDisabled() && (
						<button
							type="button"
							onClick={handleResend}
							disabled={!canResend}
							className={`px-4 py-2 rounded-md text-sm transition-colors ${
								canResend
									? 'bg-[#7B1931] text-white hover:bg-[#6a1529]'
									: 'bg-gray-200 text-gray-500 cursor-not-allowed'
							}`}
						>
							{isResending
								? 'Отправка...'
								: cooldown > 0
									? `Повторно через ${cooldown}с`
									: 'Отправить письмо повторно'}
						</button>
					)}
					<Link
						href={isEmailAuthDisabled() ? '/' : '/auth?mode=login'}
						className="px-4 py-2 rounded-md text-sm border border-gray-300 hover:bg-gray-50 text-center"
					>
						{isEmailAuthDisabled() ? 'На главную' : 'Перейти ко входу'}
					</Link>
				</div>
			</div>
		</section>
	)
}
