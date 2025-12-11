import { z } from 'zod'

export const loginSchema = z.object({
	email: z
		.string()
		.min(1, 'Email обязателен')
		.email('Некорректный формат email'),
	password: z
		.string()
		.min(1, 'Пароль обязателен')
		.min(6, 'Пароль должен содержать минимум 6 символов'),
})

export const registerSchema = z
	.object({
		name: z
			.string()
			.min(1, 'Имя обязательно')
			.min(2, 'Имя должно содержать минимум 2 символа'),
		phone: z
			.string()
			.min(1, 'Телефон обязателен')
			.regex(
				/^(\+7|8)?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/,
				'Некорректный формат телефона'
			),
		email: z
			.string()
			.min(1, 'Email обязателен')
			.email('Некорректный формат email'),
		password: z
			.string()
			.min(1, 'Пароль обязателен')
			.min(6, 'Пароль должен содержать минимум 6 символов'),
		confirmPassword: z.string().min(1, 'Подтверждение пароля обязательно'),
		agreement: z
			.boolean()
			.refine((val) => val === true, 'Необходимо согласие с условиями'),
		privacy: z
			.boolean()
			.refine((val) => val === true, 'Необходимо согласие на обработку данных'),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Пароли не совпадают',
		path: ['confirmPassword'],
	})

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
