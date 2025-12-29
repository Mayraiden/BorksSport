'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { LoginForm } from '@/features/Auth/ui/LoginForm'
import { RegisterForm } from '@/features/Auth/ui/RegisterForm'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'

export const Auth = () => {
	const searchParams = useSearchParams()
	const [mode, setMode] = useState<'login' | 'register'>('login')

	// Устанавливаем режим из query параметров
	useEffect(() => {
		const modeParam = searchParams.get('mode')
		if (modeParam === 'login' || modeParam === 'register') {
			setMode(modeParam)
		}
	}, [searchParams])

	const breadcrumbItems = [
		{ label: 'Главная', href: '/' },
		{ label: mode === 'login' ? 'Вход' : 'Регистрация' },
	]

	return (
		<div className="w-full max-w-md max-sm:w-full">
			{/* Breadcrumbs */}
			<Breadcrumbs items={breadcrumbItems} className="mb-4 max-sm:mb-2" />

			{/* Header */}
			<div className="mb-4 max-sm:mb-3">
				<h1 className="text-2xl font-bold text-black mb-2 max-sm:text-xl max-sm:mb-2">
					{mode === 'login' ? 'Вход в аккаунт' : 'Регистрация аккаунта'}
				</h1>
			</div>

			{/* Form */}
			<div className="bg-white rounded-md p-6 max-sm:p-4">
				{mode === 'login' ? <LoginForm /> : <RegisterForm />}
			</div>

			{/* Footer */}
			<div className="text-center mt-6 max-sm:mt-4">
				<p className="text-sm text-black max-sm:text-xs">
					{mode === 'login' ? (
						<>
							Нет аккаунта?{' '}
							<button
								type="button"
								onClick={() => setMode('register')}
								className="text-blue hover:underline font-medium"
							>
								Зарегистрироваться
							</button>
						</>
					) : (
						<>
							У Вас уже есть аккаунт?{' '}
							<button
								type="button"
								onClick={() => setMode('login')}
								className="text-blue hover:underline font-medium"
							>
								Войти
							</button>
						</>
					)}
				</p>
			</div>
		</div>
	)
}
