'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
	UserCircleIcon,
	HeartIcon,
	ShoppingBagIcon,
	ClockClockwiseIcon,
} from '@phosphor-icons/react/dist/ssr'

export const IProfileSideBar = () => {
	const pathname = usePathname()

	const menuItems = [
		{ href: '/profile', icon: UserCircleIcon, label: 'Профиль' },
		{ href: '/favorites', icon: HeartIcon, label: 'Избранное' },
		{ href: '/cart', icon: ShoppingBagIcon, label: 'Корзина' },
		{ href: '/orders', icon: ClockClockwiseIcon, label: 'История заказов' },
	]

	return (
		<aside className="sticky top-5 w-70 h-120 bg-white max-sm:hidden">
			<nav className="w-full pt-5 px-3">
				<ul className="w-full flex flex-col gap-3">
					{menuItems.map((item) => {
						const Icon = item.icon
						const isActive = pathname === item.href

						return (
							<li key={item.href} className="w-full">
								<Link
									className={`px-1 py-1 flex items-center gap-2 rounded-md transition ${
										isActive
											? 'bg-gray/20 text-burgundy font-medium'
											: 'hover:bg-gray/20'
									}`}
									href={item.href}
								>
									<Icon size={20} />
									<span>{item.label}</span>
								</Link>
							</li>
						)
					})}
				</ul>
			</nav>
		</aside>
	)
}
