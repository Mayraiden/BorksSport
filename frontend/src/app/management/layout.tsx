'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Header } from '@/widgets/Header/Header'
import { Footer } from '@/widgets/Footer/Footer'
import { useAuthStore } from '@/features/Auth/model/store'

type ManagementLayoutProps = {
	children: ReactNode
}

const NAV_ITEMS = [
	{ href: '/management/orders', label: 'Заказы' },
]

export default function ManagementLayout({ children }: ManagementLayoutProps) {
	const pathname = usePathname()
	const router = useRouter()
	const { isAuthenticated } = useAuthStore()

	// MVP guard: requires login. Manager role validation is enforced on API.
	useEffect(() => {
		if (!isAuthenticated) {
			router.replace(`/auth?mode=login&next=${encodeURIComponent('/management/orders')}`)
		}
	}, [isAuthenticated, router])

	const activeHref = useMemo(() => {
		return NAV_ITEMS.find((item) => pathname?.startsWith(item.href))?.href ?? NAV_ITEMS[0].href
	}, [pathname])

	if (!isAuthenticated) return null

	return (
		<section className="w-screen min-h-screen bg-[#F0F4F8] flex flex-col">
			<Header />
			<div className="flex-1 flex flex-col py-10 px-15 max-sm:py-4 max-sm:px-2">
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
			<Footer />
		</section>
	)
}

