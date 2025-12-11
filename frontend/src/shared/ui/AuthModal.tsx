'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface AuthModalProps {
	isOpen: boolean
	onClose: () => void
}

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
	const router = useRouter()

	if (!isOpen) return null

	const handleLogin = () => {
		onClose()
		router.push('/auth?mode=login')
	}

	const handleRegister = () => {
		onClose()
		router.push('/auth?mode=register')
	}

	return (
		<>
			{/* Overlay для закрытия по клику вне модала */}
			<div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

			{/* Модальное окно */}
			<div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
				<div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 relative pointer-events-auto">
					{/* Header */}
					<div className="flex items-center justify-center mb-4">
						<div className="flex items-center gap-2">
							<Image src="/logo.svg" alt="logo" width={20} height={20} />
							<span className="font-bold text-lg">ПРОФСПОРТ</span>
						</div>
					</div>

					{/* Title */}
					<h2 className="text-2xl font-bold text-black mb-3 text-center">
						Авторизация
					</h2>

					{/* Description */}
					<p className="text-gray-600 mb-6 text-sm leading-relaxed text-center">
						Войдите или создайте аккаунт, чтобы управлять избранным, оформлять и
						отслеживать заказы на сайте
					</p>

					{/* Buttons */}
					<div className="space-y-3">
						<button
							onClick={handleLogin}
							className="w-full bg-burgundy hover:bg-burgundy/90 text-white font-medium py-3 px-4 rounded-md transition-colors"
						>
							Войти
						</button>
						<button
							onClick={handleRegister}
							className="w-full border-2 border-burgundy text-burgundy hover:bg-burgundy/5 font-medium py-3 px-4 rounded-md transition-colors"
						>
							Зарегистрироваться
						</button>
					</div>
				</div>
			</div>
		</>
	)
}
