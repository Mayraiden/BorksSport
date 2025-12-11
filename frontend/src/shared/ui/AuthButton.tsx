'use client'

import { ReactNode } from 'react'

interface AuthButtonProps {
	type: 'button' | 'submit'
	children: ReactNode
	disabled?: boolean
	loading?: boolean
	className?: string
	onClick?: () => void
}

export const AuthButton = ({
	type,
	children,
	disabled = false,
	loading = false,
	className = '',
	onClick,
}: AuthButtonProps) => {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled || loading}
			className={`w-full h-14 bg-[#7B1931] text-white rounded-md font-medium text-base hover:bg-[#6a1529] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
		>
			{loading ? 'Загрузка...' : children}
		</button>
	)
}
