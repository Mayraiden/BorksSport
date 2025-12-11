'use client'

import Link from 'next/link'

import {
	UserCircleIcon,
	HeartIcon,
	ShoppingBagIcon,
	ClockClockwiseIcon,
} from '@phosphor-icons/react/dist/ssr'

export const IProfileSideBar = () => {
	return (
		<aside className="sticky top-5 w-70 h-120 bg-white">
			<nav className="w-full pt-5 px-3">
				<ul className="w-full flex flex-col gap-3">
					<li className="w-full">
						<Link
							className="px-1 py-1 flex items-center gap-2 rounded-md hover:bg-gray/20 transition"
							href={'/profile'}
						>
							<UserCircleIcon size={20} />
							<span>Профиль</span>
						</Link>
					</li>
					<li>
						<Link
							className="px-1 py-1 flex items-center gap-2 rounded-md hover:bg-gray/20 transition"
							href={'/favorites'}
						>
							<HeartIcon size={20} />
							<span>Избранное</span>
						</Link>
					</li>
					<li>
						<Link
							className="px-1 py-1 flex items-center gap-2 rounded-md hover:bg-gray/20 transition"
							href={'/cart'}
						>
							<ShoppingBagIcon size={20} />
							<span>Корзина</span>
						</Link>
					</li>
					<li>
						<Link
							className="px-1 py-1 flex items-center gap-2 rounded-md hover:bg-gray/20 transition"
							href={'/orders'}
						>
							<ClockClockwiseIcon size={20} />
							<span>История заказов</span>
						</Link>
					</li>
				</ul>
			</nav>
		</aside>
	)
}
