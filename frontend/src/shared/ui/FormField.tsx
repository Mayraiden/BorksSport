'use client'

import { ReactNode } from 'react'
import { ErrorMessage } from './ErrorMessage'

interface FormFieldProps {
	label: string
	error?: string
	children: ReactNode
	className?: string
}

export const FormField = ({
	label,
	error,
	children,
	className = '',
}: FormFieldProps) => {
	return (
		<div className={`relative flex flex-col ${className}`}>
			<div className="relative bg-[#F0F4F8] rounded-md">
				<label className="absolute top-3 left-3 text-xs text-[#A0A4A8] font-normal pointer-events-none z-10">
					{label}
				</label>
				<div className="pt-8 pb-3 px-3">{children}</div>
			</div>
			<ErrorMessage message={error} className="mt-1" />
		</div>
	)
}
