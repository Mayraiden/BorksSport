'use client'

//ui
import { FormField } from '@/shared/ui/FormField'
import { IInput } from '@/shared/ui/IInput'
import { AuthButton } from '@/shared/ui/AuthButton'
import { PasswordInput } from '@/shared/ui/PasswordInput'
import { Checkbox } from '@/shared/ui/Checkbox'

//hooks
import { useRouter } from 'next/navigation'
import { useRegister } from '../lib/queries'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
	registerSchema,
	type RegisterFormData,
} from '@/shared/lib/validations/auth'
import { useAuthStore } from '../model/store'

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
		defaultValues: {
			name: '',
			phone: '',
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

	const agreement = watch('agreement')
	const privacy = watch('privacy')

	const handleRegister = (data: RegisterFormData) => {
		registerUser(data, {
			onSuccess: () => {
				router.push('/profile')
			},
		})
	}

	return (
		<form onSubmit={handleSubmit(handleRegister)} className="space-y-3">
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
					placeholder="+7 (987) 654-32-10"
					className="bg-transparent text-base text-black outline-none"
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
			<div className="space-y-3 pt-2">
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
			<div className="pt-4">
				<AuthButton type="submit" loading={isPending}>
					Зарегистрироваться
				</AuthButton>
			</div>

			{/* Error Display */}
			{error && <div className="text-red-500 text-sm mt-2">{error}</div>}
		</form>
	)
}
