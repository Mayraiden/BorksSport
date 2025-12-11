'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Header } from '@/widgets/Header/Header'
import { Footer } from '@/widgets/Footer/Footer'
import { IProfileSideBar } from '@/shared/ui/IProfileSideBar'
import { Breadcrumbs } from '@/shared/ui/Breadcrumbs'

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
	const pageTitle = pageTitles[pathname] || 'Профиль'

	const breadcrumbItems = [
		{ label: 'Главная', href: '/' },
		{ label: pageTitle },
	]

	return (
		<section className="w-screen min-h-screen bg-[#F0F4F8] flex flex-col">
			<Header />
			<div className="flex-1 flex flex-col py-10 px-15">
				{/* Breadcrumbs над всем контентом */}
				<Breadcrumbs items={breadcrumbItems} className="mb-5" />
				<div className="flex gap-5">
					<IProfileSideBar />
					<div className="flex-1">{children}</div>
				</div>
			</div>
			<Footer />
		</section>
	)
}
