'use client'

import { useState, forwardRef } from 'react'
import { IInput } from './IInput'

interface PasswordInputProps {
	value?: string
	placeholder?: string
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
	onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
	name?: string
	className?: string
	error?: string
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
	(
		{ value, placeholder, onChange, onBlur, name, className = '', error },
		ref
	) => {
		const [showPassword, setShowPassword] = useState(false)

		return (
			<div className="relative">
				<IInput
					ref={ref}
					type={showPassword ? 'text' : 'password'}
					value={value}
					placeholder={placeholder}
					onChange={onChange}
					onBlur={onBlur}
					name={name}
					className={`bg-transparent text-base text-black outline-none disabled:cursor-not-allowed pr-20 ${className} ${
						error ? 'text-red-500' : ''
					}`}
				/>
				<button
					type="button"
					onClick={() => setShowPassword(!showPassword)}
					className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-[#A0A4A8] hover:text-gray-700"
				>
					{showPassword ? 'скрыть' : 'показать'}
				</button>
			</div>
		)
	}
)

PasswordInput.displayName = 'PasswordInput'
