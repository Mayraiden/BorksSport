'use client'

//ui
import { FormField } from '@/shared/ui/FormField'
import { IInput } from '@/shared/ui/IInput'
import { AuthButton } from '@/shared/ui/AuthButton'
import { PasswordInput } from '@/shared/ui/PasswordInput'
import { Checkbox } from '@/shared/ui/Checkbox'

//hooks
import { useRouter, useSearchParams } from 'next/navigation'
import { useRegister } from '../lib/queries'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
	registerSchema,
	type RegisterFormData,
} from '@/shared/lib/validations/auth'
import { useAuthStore } from '../model/store'
import { isEmailAuthDisabled } from '@/shared/config/emailAuth'

const getSafeNextPath = (raw: string | null): string | null => {
	if (!raw) return null
	// Only allow same-origin relative paths to prevent open redirects.
	if (!raw.startsWith('/')) return null
	if (raw.startsWith('//')) return null
	if (raw.includes('://')) return null
	return raw
}

// Функция для форматирования телефона с маской +7
const formatPhoneNumber = (value: string): string => {
	// Удаляем все нецифровые символы
	const digits = value.replace(/\D/g, '')
	
	// Если начинается с 7 или 8, заменяем на 7
	let phoneDigits = digits
	if (phoneDigits.startsWith('8')) {
		phoneDigits = '7' + phoneDigits.slice(1)
	} else if (phoneDigits.startsWith('7')) {
		phoneDigits = phoneDigits
	} else if (phoneDigits.length > 0) {
		// Если не начинается с 7 или 8, добавляем 7
		phoneDigits = '7' + phoneDigits
	}
	
	// Ограничиваем до 11 цифр (7 + 10 цифр номера)
	phoneDigits = phoneDigits.slice(0, 11)
	
	// Форматируем в +7 (XXX) XXX-XX-XX
	if (phoneDigits.length === 0) {
		return '+7'
	}
	
	const code = phoneDigits.slice(1, 4)
	const part1 = phoneDigits.slice(4, 7)
	const part2 = phoneDigits.slice(7, 9)
	const part3 = phoneDigits.slice(9, 11)
	
	let formatted = '+7'
	if (code) formatted += ` (${code}`
	if (part1) formatted += `) ${part1}`
	if (part2) formatted += `-${part2}`
	if (part3) formatted += `-${part3}`
	
	return formatted
}

//component
export const RegisterForm = () => {
	//react-hook-form
	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch,
	} = useForm<RegisterFormData>({
		resolver: zodResolver(registerSchema),
		mode: 'onSubmit', // Валидация только при отправке формы
		reValidateMode: 'onSubmit', // Повторная валидация только при отправке
		defaultValues: {
			name: '',
			phone: '+7',
			email: '',
			password: '',
			confirmPassword: '',
			agreement: false,
			privacy: false,
		},
	})

	//register logic
	const { mutate: registerUser, isPending } = useRegister()
	const { error } = useAuthStore()
	const router = useRouter()
	const searchParams = useSearchParams()

	const agreement = watch('agreement')
	const privacy = watch('privacy')
	const phoneValue = watch('phone')

	const handleRegister = (data: RegisterFormData) => {
		registerUser(data, {
			onSuccess: () => {
				if (isEmailAuthDisabled()) {
					const next = getSafeNextPath(searchParams.get('next'))
					router.push(next ?? '/')
					return
				}
				const next = getSafeNextPath(searchParams.get('next'))
				const params = new URLSearchParams()
				params.set('email', data.email)
				if (next) params.set('next', next)
				router.push(`/auth/confirm-email?${params.toString()}`)
			},
			onError: () => {
				// Ошибка обрабатывается через useAuthStore
			},
		})
	}

	return (
		<form
			onSubmit={handleSubmit(handleRegister)}
			className="space-y-3 max-sm:space-y-2.5"
		>
			{/* Name */}
			<FormField label="Имя" error={errors.name?.message}>
				<IInput
					{...register('name')}
					type="text"
					placeholder="Иванов Иван"
					className="bg-transparent text-base text-black outline-none"
				/>
			</FormField>

			{/* Phone */}
			<FormField label="Телефон" error={errors.phone?.message}>
				<IInput
					{...register('phone')}
					type="tel"
					value={phoneValue || '+7'}
					placeholder="+7 (987) 654-32-10"
					className="bg-transparent text-base text-black outline-none"
					onChange={(e) => {
						const formatted = formatPhoneNumber(e.target.value)
						setValue('phone', formatted, { shouldValidate: false })
					}}
					onFocus={(e) => {
						// Если поле пустое или только +7, выделяем все для удобства замены
						if (!e.target.value || e.target.value === '+7') {
							e.target.setSelectionRange(2, 2)
						}
					}}
				/>
			</FormField>

			{/* Email */}
			<FormField label="Email" error={errors.email?.message}>
				<IInput
					{...register('email')}
					type="email"
					placeholder="yourown@gmail.com"
					className="bg-transparent text-base text-black outline-none"
				/>
			</FormField>

			{/* Password */}
			<FormField label="Придумайте пароль" error={errors.password?.message}>
				<PasswordInput {...register('password')} placeholder="******" />
			</FormField>

			{/* Confirm Password */}
			<FormField
				label="Повторите пароль"
				error={errors.confirmPassword?.message}
			>
				<PasswordInput {...register('confirmPassword')} placeholder="******" />
			</FormField>

			{/* Checkboxes */}
			<div className="space-y-3 pt-2 max-sm:space-y-2 max-sm:pt-1.5">
				<Checkbox
					checked={agreement}
					onChange={(checked) => setValue('agreement', checked)}
					size="sm"
				>
					Я согласен(-на) с условиями{' '}
					<a href="#" className="text-blue hover:underline">
						Публичной оферты
					</a>{' '}
					и{' '}
					<a href="#" className="text-blue hover:underline">
						Пользовательским соглашением
					</a>
				</Checkbox>

				<Checkbox
					checked={privacy}
					onChange={(checked) => setValue('privacy', checked)}
					size="sm"
				>
					Я ознакомлен с{' '}
					<a href="#" className="text-blue hover:underline">
						условиями
					</a>{' '}
					и даю согласие на обработку{' '}
					<a href="#" className="text-blue hover:underline">
						Персональных данных
					</a>
				</Checkbox>
			</div>

			{/* Submit Button */}
			<div className="pt-4 max-sm:pt-3">
				<AuthButton type="submit" loading={isPending}>
					Зарегистрироваться
				</AuthButton>
			</div>

			{/* Error Display */}
			{error && (
				<div className="text-red-500 text-sm mt-2 max-sm:text-xs max-sm:mt-1.5">
					{error}
				</div>
			)}
		</form>
	)
}
