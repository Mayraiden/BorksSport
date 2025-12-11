import { forwardRef } from 'react'

type IInputProps = {
	value?: string
	placeholder?: string
	type?: 'text' | 'password' | 'email' | 'tel'
	disabled?: boolean
	className?: string
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
} & React.InputHTMLAttributes<HTMLInputElement>

export const IInput = forwardRef<HTMLInputElement, IInputProps>(
	(
		{
			value,
			placeholder,
			type = 'text',
			disabled = false,
			className = '',
			onChange,
			...props
		},
		ref
	) => {
		return (
			<input
				ref={ref}
				className={`w-full bg-transparent outline-none border-none text-base font-normal leading-[1.3125] text-black placeholder:text-[#A0A4A8] placeholder:opacity-25 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
				type={type}
				disabled={disabled}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				{...props}
			/>
		)
	}
)

IInput.displayName = 'IInput'
