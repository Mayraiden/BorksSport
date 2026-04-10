'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Header } from '@/widgets/Header/Header'
import { Footer } from '@/widgets/Footer/Footer'
import { IProfileSideBar } from '@/shared/ui/IProfileSideBar'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'
import { useAuthStore } from '@/features/Auth/model/store'
import { sessionManager } from '@/features/Auth/lib/sessionManager'

interface ProfileLayoutProps {
	children: ReactNode
}

type PersistApi = {
	hasHydrated?: () => boolean
	onFinishHydration?: (cb: () => void) => (() => void) | void
}

// Маппинг путей к названиям страниц
const pageTitles: Record<string, string> = {
	'/profile': 'Профиль',
	'/favorites': 'Избранное',
	'/cart': 'Корзина',
	'/orders': 'История заказов',
}

export const ProfileLayout = ({ children }: ProfileLayoutProps) => {
	const pathname = usePathname()
	const router = useRouter()
	const { isAuthenticated, isRestoring } = useAuthStore()
	const persistApi = (useAuthStore as unknown as { persist?: PersistApi }).persist
	const [hasHydrated, setHasHydrated] = useState(() => {
		return typeof persistApi?.hasHydrated === 'function' ? Boolean(persistApi.hasHydrated()) : true
	})
	const [restoreAttempted, setRestoreAttempted] = useState(false)
	const pageTitle = pageTitles[pathname] || 'Профиль'
	const nextUrl = useMemo(() => pathname || '/profile', [pathname])

	useEffect(() => {
		if (persistApi?.onFinishHydration) {
			const unsubscribe = persistApi.onFinishHydration(() => {
				setHasHydrated(true)
			})
			if (typeof persistApi.hasHydrated === 'function' && persistApi.hasHydrated()) {
				setHasHydrated(true)
			}
			return () => {
				if (typeof unsubscribe === 'function') unsubscribe()
			}
		}
		return
	}, [persistApi])

	useEffect(() => {
		if (!hasHydrated) return
		if (!isAuthenticated && !isRestoring && !restoreAttempted) {
			setRestoreAttempted(true)
			void sessionManager.restoreSession().catch(() => null)
		}
	}, [hasHydrated, isAuthenticated, isRestoring, restoreAttempted])

	const breadcrumbItems = [
		{ label: 'Главная', href: '/' },
		{ label: pageTitle },
	]

	return (
		<section className="w-screen min-h-screen bg-[#F0F4F8] flex flex-col">
			<Header />
			<div className="flex-1 flex flex-col py-10 px-15 max-sm:py-4 max-sm:px-2">
				{/* Breadcrumbs над всем контентом */}
				<Breadcrumbs items={breadcrumbItems} className="mb-5 max-sm:mb-2" />
				{!hasHydrated || isRestoring ? null : isAuthenticated ? (
					<div className="flex gap-5 max-sm:flex-col">
						<IProfileSideBar />
						<div className="flex-1">{children}</div>
					</div>
				) : (
					<div className="bg-white rounded-md border border-gray-100 shadow-sm p-6 max-sm:p-4">
						<div className="text-lg font-semibold text-black mb-2">Нужно войти в аккаунт</div>
						<div className="text-sm text-gray-600 mb-4">
							Чтобы открыть эту страницу, выполните вход.
						</div>
						<div className="flex gap-2 flex-wrap">
							<Link
								href={`/auth?mode=login&next=${encodeURIComponent(nextUrl)}`}
								className="h-9 px-3 rounded-md bg-[#7B1931] text-white text-sm hover:bg-[#6a1529] transition-colors inline-flex items-center justify-center"
							>
								Войти
							</Link>
							<button
								type="button"
								onClick={() => router.replace('/')}
								className="h-9 px-3 rounded-md border border-gray-200 text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors inline-flex items-center justify-center"
							>
								На главную
							</button>
						</div>
					</div>
				)}
			</div>
			<Footer />
		</section>
	)
}
