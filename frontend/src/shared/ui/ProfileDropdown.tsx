'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
	DotsThreeOutline,
	UserCircleIcon,
	HeartIcon,
	ShoppingBagIcon,
	ClockClockwiseIcon,
} from '@phosphor-icons/react/ssr'

type MenuItem = {
	href: string
	icon: React.ComponentType<{ size?: number; className?: string }>
	label: string
}

const menuItems: MenuItem[] = [
	{ href: '/profile', icon: UserCircleIcon, label: 'Профиль' },
	{ href: '/favorites', icon: HeartIcon, label: 'Избранное' },
	{ href: '/cart', icon: ShoppingBagIcon, label: 'Корзина' },
	{ href: '/orders', icon: ClockClockwiseIcon, label: 'История заказов' },
]

export const ProfileDropdown = () => {
	const [isOpen, setIsOpen] = useState(false)
	const pathname = usePathname()
	const dropdownRef = useRef<HTMLDivElement>(null)

	// Закрываем dropdown при клике вне его
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setIsOpen(false)
			}
		}

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen])

	const handleItemClick = () => {
		setIsOpen(false)
	}

	return (
		<div className="relative md:hidden" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray/20 transition-colors duration-200"
				aria-label="Меню профиля"
			>
				<DotsThreeOutline size={24} weight="bold" />
			</button>

			{/* Dropdown меню */}
			{isOpen && (
				<div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray/20 rounded-md shadow-lg z-50 overflow-hidden">
					<ul className="py-2">
						{menuItems.map((item) => {
							const Icon = item.icon
							const isActive = pathname === item.href

							return (
								<li key={item.href}>
									<Link
										href={item.href}
										onClick={handleItemClick}
										className={`px-4 py-3 flex items-center gap-3 transition-colors duration-200 ${
											isActive
												? 'bg-gray/20 text-burgundy font-medium'
												: 'hover:bg-gray/10 text-black'
										}`}
									>
										<Icon size={20} />
										<span>{item.label}</span>
									</Link>
								</li>
							)
						})}
					</ul>
				</div>
			)}
		</div>
	)
}
