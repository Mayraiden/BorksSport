'use client'

import Link from 'next/link'
import { CaretRightIcon } from '@phosphor-icons/react/ssr'

type ICatalogModalLinkProps = {
	text: string
	href: string
	className?: string
	isSelected?: boolean
	hasChildren?: boolean
	onClick?: (e: React.MouseEvent) => void
	onMouseEnter?: (e: React.MouseEvent) => void
	onClose?: () => void
}

export const ICatalogModalLink = ({
	text,
	href,
	className,
	isSelected = false,
	hasChildren = false,
	onClick,
	onMouseEnter,
	onClose,
}: ICatalogModalLinkProps) => {
	const handleClick = (e: React.MouseEvent) => {
		if (onClick) {
			onClick(e)
			// Если есть дети, предотвращаем переход по ссылке
			if (hasChildren) {
				e.preventDefault()
			} else if (onClose) {
				// Если нет детей, закрываем модалку после перехода
				setTimeout(() => {
					onClose()
				}, 100)
			}
		} else if (onClose) {
			onClose()
		}
	}

	const handleMouseEnter = (e: React.MouseEvent) => {
		if (hasChildren && onMouseEnter) {
			onMouseEnter(e)
		}
	}

	return (
		<Link
			className={`w-45 h-7 p-2 flex justify-between items-center rounded-md transition-colors whitespace-nowrap ${
				isSelected
					? 'bg-gray/30 text-burgundy font-medium'
					: 'bg-white hover:bg-gray/20'
			} ${className}`}
			href={href}
			onClick={handleClick}
			onMouseEnter={handleMouseEnter}
		>
			<span>{text}</span>
			{hasChildren && <CaretRightIcon size={20} />}
		</Link>
	)
}
