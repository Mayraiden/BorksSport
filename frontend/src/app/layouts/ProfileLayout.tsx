'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Header } from '@/widgets/Header/Header'
import { Footer } from '@/widgets/Footer/Footer'
import { IProfileSideBar } from '@/shared/ui/IProfileSideBar'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'
import { useAuthStore } from '@/features/Auth/model/store'

interface ProfileLayoutProps {
	children: ReactNode
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
	const { isAuthenticated } = useAuthStore()
	const pageTitle = pageTitles[pathname] || 'Профиль'

	// Защита профиля - редирект если не авторизован
	useEffect(() => {
		if (!isAuthenticated) {
			router.push('/')
		}
	}, [isAuthenticated, router])

	const breadcrumbItems = [
		{ label: 'Главная', href: '/' },
		{ label: pageTitle },
	]

	// Если не авторизован, не рендерим контент
	if (!isAuthenticated) {
		return null
	}

	return (
		<section className="w-screen min-h-screen bg-[#F0F4F8] flex flex-col">
			<Header />
			<div className="flex-1 flex flex-col py-10 px-15 max-sm:py-4 max-sm:px-2">
				{/* Breadcrumbs над всем контентом */}
				<Breadcrumbs items={breadcrumbItems} className="mb-5 max-sm:mb-2" />
				<div className="flex gap-5 max-sm:flex-col">
					<IProfileSideBar />
					<div className="flex-1">{children}</div>
				</div>
			</div>
			<Footer />
		</section>
	)
}
