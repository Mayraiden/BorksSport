'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

import { DropDownButton } from '@/shared/ui/DropDownButton'
import { SearchForm } from '@/shared/ui/SearchForm'
import { CatalogModal } from '@/widgets/CatalogModal/CatalogModal'
import { useAuthModal } from '@/shared/lib/contexts/AuthModalContext'
import { useAuthStore } from '@/features/Auth/model/store'
import { useSearch } from '@/shared/lib/contexts/SearchContext'
import { useFavoritesCount } from '@/features/Favorites/lib/useFavoritesCount'
import { useCartCount } from '@/features/Cart/lib/useCartCount'

import {
	HeartStraightIcon,
	ShoppingBagIcon,
	UserIcon,
} from '@phosphor-icons/react/ssr'

export const Header = () => {
	const [isCatalogOpen, setIsCatalogOpen] = useState(false)
	const { openModal } = useAuthModal()
	const { isAuthenticated } = useAuthStore()
	const { searchQuery, setSearchQuery } = useSearch()
	const { count: favoritesCount } = useFavoritesCount()
	const { count: cartCount } = useCartCount()

	const toggleCatalog = () => {
		setIsCatalogOpen(!isCatalogOpen)
	}

	const handleAuthClick = (e: React.MouseEvent) => {
		if (!isAuthenticated) {
			e.preventDefault()
			openModal()
		}
	}

	const handleSearch = (query: string) => {
		setSearchQuery(query)
		// Navigate to catalog if not already there
		if (window.location.pathname !== '/catalog') {
			window.location.href = `/catalog?search=${encodeURIComponent(query)}`
		}
	}

	return (
		<>
			<nav className="h-20 w-full mx-auto px-10 py-5 flex items-center gap-5 bg-white relative z-50">
				<Link href="/" className="h-10 flex items-center md:w-40">
					<Image
						src="/logo.svg"
						width={250}
						height={40}
						alt="логотип профспорт"
					/>
				</Link>

				<DropDownButton isOpen={isCatalogOpen} onClick={toggleCatalog} />
				<SearchForm
					type="text"
					placeholder="Найти"
					className="w-full h-full px-2 bg-gray/20 rounded-sm outline-none focus:bg-gray/30"
					onSearch={handleSearch}
					value={searchQuery}
					containerClassName="flex-1 min-w-0"
				/>
				<Link
					href="/favorites"
					onClick={handleAuthClick}
					className="w-10 h-10 relative flex items-center justify-center bg-gray/20 hover:bg-gray/30 transition-colors duration-200"
				>
					<HeartStraightIcon size={20} weight="fill" />
					{isAuthenticated && favoritesCount > 0 && (
						<span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center bg-burgundy text-white text-[10px] font-bold rounded-full">
							{favoritesCount > 99 ? '99+' : favoritesCount}
						</span>
					)}
				</Link>
				<Link
					href="/cart"
					onClick={handleAuthClick}
					className="w-10 h-10 relative flex items-center justify-center bg-gray/20 hover:bg-gray/30 transition-colors duration-200"
				>
					<ShoppingBagIcon size={20} weight="fill" />
					{isAuthenticated && cartCount > 0 && (
						<span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center bg-burgundy text-white text-[10px] font-bold rounded-full">
							{cartCount > 99 ? '99+' : cartCount}
						</span>
					)}
				</Link>
				<Link
					href="/profile"
					onClick={handleAuthClick}
					className="w-10 h-10 flex items-center justify-center bg-gray/20 rounded-full hover:bg-gray/30 transition-colors duration-200"
				>
					<UserIcon size={20} weight="fill" />
				</Link>
			</nav>

			<CatalogModal
				isOpen={isCatalogOpen}
				onClose={() => setIsCatalogOpen(false)}
			/>
		</>
	)
}
