'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X } from '@phosphor-icons/react'

export const CookieBanner = () => {
	const [isVisible, setIsVisible] = useState(false)

	useEffect(() => {
		// Проверяем, было ли уже дано согласие
		const cookieConsent = localStorage.getItem('cookieConsent')
		if (!cookieConsent) {
			setIsVisible(true)
		}
	}, [])

	const handleAccept = () => {
		localStorage.setItem('cookieConsent', 'accepted')
		setIsVisible(false)
	}

	const handleDecline = () => {
		localStorage.setItem('cookieConsent', 'declined')
		setIsVisible(false)
	}

	if (!isVisible) return null

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg p-4 md:p-6">
			<div className="max-w-[1040px] mx-auto flex flex-col md:flex-row items-start md:items-center gap-4">
				<div className="flex-1">
					<p className="text-sm text-gray-700 mb-2">
						Мы используем файлы cookie для улучшения работы сайта и персонализации контента.
						Продолжая использовать сайт, вы соглашаетесь с использованием cookies.
					</p>
					<p className="text-xs text-gray-500">
						Подробнее в{' '}
						<Link href="/cookies" className="text-blue-600 hover:underline">
							политике использования cookies
						</Link>
						{' '}и{' '}
						<Link href="/privacy" className="text-blue-600 hover:underline">
							политике конфиденциальности
						</Link>
					</p>
				</div>
				<div className="flex gap-3 flex-shrink-0">
					<button
						onClick={handleDecline}
						className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
					>
						Отклонить
					</button>
					<button
						onClick={handleAccept}
						className="px-4 py-2 text-sm font-medium text-white bg-[#7B1931] rounded-md hover:bg-[#5d1325] transition-colors"
					>
						Принять
					</button>
					<button
						onClick={handleDecline}
						className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
						aria-label="Закрыть"
					>
						<X size={20} />
					</button>
				</div>
			</div>
		</div>
	)
}

