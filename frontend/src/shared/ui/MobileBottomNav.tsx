'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
	HouseSimple as HouseIcon,
	QrCode as QrCodeIcon,
	HeartStraight as HeartStraightIcon,
	ShoppingBag as ShoppingBagIcon,
	User as UserIcon,
} from '@phosphor-icons/react/ssr'

import { useAuthModal } from '@/shared/lib/contexts/AuthModalContext'
import { useAuthStore } from '@/features/Auth/model/store'
import { useFavoritesCount } from '@/features/Favorites/lib/useFavoritesCount'
import { useCartCount } from '@/features/Cart/lib/useCartCount'

type NavItem = {
	id: string
	href: string
	icon: React.ComponentType<{
		size?: number
		weight?: 'regular' | 'fill' | 'bold' | 'thin' | 'light' | 'duotone'
		className?: string
	}>
	label: string
	isActive: boolean
	onClick?: (e: React.MouseEvent) => void
	badge?: number | null
}

export const MobileBottomNav = () => {
	const pathname = usePathname()
	const { openModal } = useAuthModal()
	const { isAuthenticated } = useAuthStore()
	const { count: favoritesCount } = useFavoritesCount()
	const { count: cartCount } = useCartCount()

	const handleAuthClick = (e: React.MouseEvent) => {
		if (!isAuthenticated) {
			e.preventDefault()
			openModal()
		}
	}

	const isActive = (path: string) => pathname === path

	const navItems: NavItem[] = [
		{
			id: 'home',
			href: '/',
			icon: HouseIcon,
			label: 'Главная',
			isActive: isActive('/'),
		},
		{
			id: 'catalog',
			href: '/catalog',
			icon: QrCodeIcon,
			label: 'Каталог',
			isActive: pathname?.startsWith('/catalog') || false,
		},
		{
			id: 'favorites',
			href: '/favorites',
			icon: HeartStraightIcon,
			label: 'Избранное',
			isActive: isActive('/favorites'),
			onClick: handleAuthClick,
			badge: isAuthenticated && favoritesCount > 0 ? favoritesCount : null,
		},
		{
			id: 'cart',
			href: '/cart',
			icon: ShoppingBagIcon,
			label: 'Корзина',
			isActive: isActive('/cart'),
			onClick: handleAuthClick,
			badge: isAuthenticated && cartCount > 0 ? cartCount : null,
		},
		{
			id: 'profile',
			href: '/profile',
			icon: UserIcon,
			label: 'Профиль',
			isActive:
				pathname?.startsWith('/profile') ||
				pathname?.startsWith('/orders') ||
				false,
			onClick: handleAuthClick,
		},
	]

	return (
		<>
			<nav
				className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg md:hidden safe-area-bottom"
				style={{
					paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
				}}
			>
				<ul className="flex items-center justify-around h-16 px-2">
					{navItems.map((item) => {
						const Icon = item.icon
						const isItemActive = item.isActive
						const badge = item.badge

						return (
							<li key={item.id} className="flex-1">
								{item.onClick ? (
									<Link
										href={item.href}
										onClick={item.onClick}
										className="flex flex-col items-center justify-center gap-1 h-full relative"
									>
										<div className="relative">
											<Icon
												size={24}
												weight={isItemActive ? 'fill' : 'regular'}
												className={
													isItemActive
														? 'text-burgundy'
														: 'text-gray-600'
												}
											/>
											{badge !== null && badge !== undefined && typeof badge === 'number' && (
												<span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-burgundy text-white text-[10px] font-bold rounded-full">
													{badge > 99 ? '99+' : badge}
												</span>
											)}
										</div>
										<span
											className={`text-[10px] ${
												isItemActive
													? 'text-burgundy font-semibold'
													: 'text-gray-600'
											}`}
										>
											{item.label}
										</span>
									</Link>
								) : (
									<Link
										href={item.href}
										className="flex flex-col items-center justify-center gap-1 h-full relative"
									>
										<div className="relative">
											<Icon
												size={24}
												weight={isItemActive ? 'fill' : 'regular'}
												className={
													isItemActive
														? 'text-burgundy'
														: 'text-gray-600'
												}
											/>
											{badge !== null && badge !== undefined && typeof badge === 'number' && (
												<span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-burgundy text-white text-[10px] font-bold rounded-full">
													{badge > 99 ? '99+' : badge}
												</span>
											)}
										</div>
										<span
											className={`text-[10px] ${
												isItemActive
													? 'text-burgundy font-semibold'
													: 'text-gray-600'
											}`}
										>
											{item.label}
										</span>
									</Link>
								)}
							</li>
						)
					})}
				</ul>
			</nav>
		</>
	)
}

