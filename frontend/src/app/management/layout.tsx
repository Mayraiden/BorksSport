'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/features/Auth/model/store'
import { sessionManager } from '@/features/Auth/lib/sessionManager'

type ManagementLayoutProps = {
	children: ReactNode
}

type PersistApi = {
	hasHydrated?: () => boolean
	onFinishHydration?: (cb: () => void) => (() => void) | void
}

const NAV_ITEMS = [
	{ href: '/management/orders', label: 'Заказы' },
]

export default function ManagementLayout({ children }: ManagementLayoutProps) {
	const pathname = usePathname()
	const router = useRouter()
	const { isAuthenticated, user, logout, isRestoring } = useAuthStore()
	const persistApi = (useAuthStore as unknown as { persist?: PersistApi }).persist
	const [restoreAttempted, setRestoreAttempted] = useState(false)
	const [hasHydrated, setHasHydrated] = useState(() => {
		// zustand/persist exposes these helpers on the store
		return typeof persistApi?.hasHydrated === 'function'
			? Boolean(persistApi.hasHydrated())
			: true
	})

	// MVP guard: requires login. Manager role validation is enforced on API.
	useEffect(() => {
		if (persistApi?.onFinishHydration) {
			const unsubscribe = persistApi.onFinishHydration(() => {
				setHasHydrated(true)
			})
			// In case it was already hydrated, mark immediately.
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
		if (!hasHydrated) {
			return
		}
		// Attempt session restore via refresh cookie before redirecting
		if (!isAuthenticated && !isRestoring && !restoreAttempted) {
			setRestoreAttempted(true)
			void sessionManager.restoreSession().catch(() => null)
			return
		}
		// If restore finished/attempted but auth is still missing, redirect
		if (!isRestoring && !isAuthenticated && restoreAttempted) {
			router.replace(`/auth?mode=login&next=${encodeURIComponent('/management/orders')}`)
		}
	}, [hasHydrated, isAuthenticated, isRestoring, restoreAttempted, router])

	const activeHref = useMemo(() => {
		return NAV_ITEMS.find((item) => pathname?.startsWith(item.href))?.href ?? NAV_ITEMS[0].href
	}, [pathname])

	if (!hasHydrated) return null
	if (isRestoring) return null
	if (!isAuthenticated) return null

	return (
		<section className="w-screen min-h-screen bg-[#F0F4F8] flex flex-col">
			<header className="w-full bg-white border-b border-gray-100">
				<div className="mx-auto max-w-[1280px] px-6 max-sm:px-3 h-16 flex items-center justify-between">
					<div className="flex items-center gap-3 min-w-0">
						<div className="text-sm font-semibold text-black whitespace-nowrap">
							Управление заказами
						</div>
						<span className="text-xs px-2 py-1 rounded-full bg-[#F2E8EA] text-[#7B1931] whitespace-nowrap">
							Менеджер
						</span>
						{user?.email && (
							<span className="text-xs text-gray-500 truncate">
								{user.email}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						<Link
							href="/"
							className="h-9 px-3 rounded-md border border-gray-200 text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors inline-flex items-center justify-center"
						>
							На сайт
						</Link>
						<button
							type="button"
							onClick={() => {
								logout()
								router.replace('/auth?mode=login')
							}}
							className="h-9 px-3 rounded-md bg-[#7B1931] text-white text-sm hover:bg-[#6a1529] transition-colors inline-flex items-center justify-center"
						>
							Выйти
						</button>
					</div>
				</div>
			</header>

			<div className="flex-1 flex flex-col py-8 px-6 max-sm:py-4 max-sm:px-2 mx-auto w-full max-w-[1280px]">
				<div className="flex gap-5 max-sm:flex-col">
					<aside className="w-[260px] max-sm:w-full bg-white rounded-md border border-gray-100 shadow-sm p-4">
						<div className="text-sm font-semibold text-black mb-3">Управление</div>
						<nav className="flex flex-col gap-1">
							{NAV_ITEMS.map((item) => {
								const isActive = item.href === activeHref
								return (
									<Link
										key={item.href}
										href={item.href}
										className={`px-3 py-2 rounded-md text-sm transition-colors ${
											isActive ? 'bg-[#F2E8EA] text-black' : 'text-gray-600 hover:bg-gray-50'
										}`}
									>
										{item.label}
									</Link>
								)
							})}
						</nav>
					</aside>
					<div className="flex-1">{children}</div>
				</div>
			</div>
		</section>
	)
}

