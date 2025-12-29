'use client'

import { ReactNode } from 'react'
import { CheckIcon } from '@phosphor-icons/react/ssr'
import '../../widgets/Filters/Filters.css'

interface CheckboxProps {
	checked: boolean
	onChange: (checked: boolean) => void
	children: ReactNode
	className?: string
	size?: 'sm' | 'md' | 'lg'
}

export const Checkbox = ({
	checked,
	onChange,
	children,
	className = '',
	size = 'md',
}: CheckboxProps) => {
	const textSizeClasses = {
		sm: 'text-xs max-sm:text-[10px]',
		md: 'text-sm max-sm:text-xs',
		lg: 'text-base max-sm:text-sm',
	}

	return (
		<label
			className={`flex items-center space-x-3 cursor-pointer group max-sm:space-x-2 ${className}`}
		>
			<div className="relative flex justify-center items-center">
				<input
					type="checkbox"
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
					className="custom-checkbox"
				/>
				{checked && (
					<CheckIcon
						size={size === 'sm' ? 10 : size === 'md' ? 12 : 14}
						className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white pointer-events-none"
					/>
				)}
			</div>
			<span
				className={`${textSizeClasses[size]} text-gray-700 flex-1 group-hover:text-black transition-colors duration-200`}
			>
				{children}
			</span>
		</label>
	)
}
