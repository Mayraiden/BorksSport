'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { loginSchema, type LoginFormData } from '@/shared/lib/validations/auth'
import { IInput } from '@/shared/ui/IInput'
import { AuthButton } from '@/shared/ui/AuthButton'
import { FormField } from '@/shared/ui/FormField'
import { PasswordInput } from '@/shared/ui/PasswordInput'
import { useLogin } from '../lib/queries'
import { useAuthStore } from '../model/store'

export const LoginForm = () => {
	const router = useRouter()
	const { mutate: loginUser, isPending } = useLogin()
	const { error } = useAuthStore()

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
	})

	const handleLogin = (data: LoginFormData) => {
		loginUser(data, {
			onSuccess: () => {
				router.push('/profile')
			},
		})
	}

	return (
		<form onSubmit={handleSubmit(handleLogin)} className="space-y-3">
			{/* Email */}
			<FormField label="Email" error={errors.email?.message}>
				<IInput
					{...register('email')}
					type="email"
					placeholder="yourown@gmail.com"
					className="bg-transparent text-base text-black outline-none focus:outline-none"
				/>
			</FormField>

			{/* Password */}
			<FormField label="Пароль" error={errors.password?.message}>
				<PasswordInput {...register('password')} placeholder="**********" />
			</FormField>

			{/* Submit Button */}
			<div className="pt-4">
				<AuthButton type="submit" loading={isPending}>
					Войти
				</AuthButton>
			</div>

			{/* Error Display */}
			{error && <div className="text-red-500 text-sm mt-2">{error}</div>}
		</form>
	)
}
