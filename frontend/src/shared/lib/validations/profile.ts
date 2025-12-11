import { z } from 'zod'

export const profileSchema = z.object({
	name: z.string().min(1, 'Имя обязательно'),
	phone: z.string().min(1, 'Телефон обязателен'),
	email: z.string().email('Неверный формат email'),
})

export type ProfileFormData = z.infer<typeof profileSchema>
