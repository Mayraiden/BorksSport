'use client'

import Link from 'next/link'
import { CaretRightIcon } from '@phosphor-icons/react/ssr'

type BreadcrumbItem = {
	label: string
	href?: string
}

type BreadcrumbsProps = {
	items: BreadcrumbItem[]
	className?: string
}

export const Breadcrumbs = ({ items, className = '' }: BreadcrumbsProps) => {
	if (!items.length) return null

	return (
		<nav
			className={`flex items-center gap-2 text-xs font-normal leading-[1.75] text-[#A0A4A8] ${className}`}
			aria-label="Breadcrumb"
		>
		{items.map((item, index) => {
			const isLast = index === items.length - 1

			return (
					<div key={index} className="flex items-center gap-2">
						{index > 0 && (
							<CaretRightIcon size={14} className="text-gray-400" />
						)}
						{isLast ? (
							<span className="text-[#121212]">{item.label}</span>
						) : (
							<Link
								href={item.href || '#'}
								className="text-[#A0A4A8] hover:text-[#7B1931] transition-colors duration-200"
							>
								{item.label}
							</Link>
						)}
					</div>
				)
			})}
		</nav>
	)
}
