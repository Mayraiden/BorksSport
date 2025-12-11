import Link from 'next/link'
import { CaretRightIcon } from '@phosphor-icons/react/ssr'

type ICatalogModalLinkProps = {
	text: string
	href: string
	className?: string
}

export const ICatalogModalLink = ({
	text,
	href,
	className,
}: ICatalogModalLinkProps) => {
	return (
		<Link
			className={`w-45 h-7 p-2 flex justify-between items-center rounded-md transition-colors bg-white hover:bg-gray/20 ${className}`}
			href={href}
		>
			<span>{text}</span>
			<CaretRightIcon size={20} />
		</Link>
	)
}
