'use client'
import { QrCodeIcon } from '@phosphor-icons/react'

interface DropDownButtonProps {
	isOpen: boolean
	onClick: () => void
}

export const DropDownButton = ({ isOpen, onClick }: DropDownButtonProps) => {
	return (
		<button
			onClick={onClick}
			className={`w-30.5 h-full flex gap-2 items-center justify-center rounded-sm cursor-pointer transition-colors duration-200 ${
				isOpen ? 'bg-light-blue' : 'bg-gray/20 hover:bg-gray/30'
			}`}
		>
			<QrCodeIcon size={20} weight="bold" />
			<span className="text-base font-bold">КАТАЛОГ</span>
		</button>
	)
}
