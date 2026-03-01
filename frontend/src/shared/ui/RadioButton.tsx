'use client'

import { ReactNode } from 'react'

interface RadioButtonProps {
	checked: boolean
	onChange: (checked: boolean) => void
	children: ReactNode
	className?: string
}

export const RadioButton = ({
	checked,
	onChange,
	children,
	className = '',
}: RadioButtonProps) => {
	return (
		<label
			className={`flex items-center space-x-3 cursor-pointer group max-sm:space-x-2 ${className}`}
		>
			<div
				className={`w-[18px] h-[18px] max-sm:w-5 max-sm:h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${
					checked
						? 'border-[#7B1931] bg-[#7B1931]'
						: 'border-gray-300 bg-white group-hover:border-[#7B1931]'
				}`}
				onClick={() => onChange(true)}
			>
				{checked && (
					<div className="w-[7px] h-[7px] max-sm:w-2 max-sm:h-2 rounded-full bg-white" />
				)}
			</div>
			<span className="text-sm max-sm:text-base text-gray-700 flex-1 group-hover:text-black transition-colors duration-200">
				{children}
			</span>
		</label>
	)
}
