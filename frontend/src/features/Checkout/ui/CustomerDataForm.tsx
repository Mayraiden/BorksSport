'use client'

import { SectionHeader } from '@/shared/ui/SectionHeader'
import { FormField } from '@/shared/ui/FormField'
import { IInput } from '@/shared/ui/IInput'
import type { CustomerData } from '../model/types'

type CustomerDataFormProps = {
	data: CustomerData
	errors?: {
		name?: string
		phone?: string
		email?: string
	}
	onChange: (data: Partial<CustomerData>) => void
}

export const CustomerDataForm = ({
	data,
	errors,
	onChange,
}: CustomerDataFormProps) => {
	return (
		<div className="bg-white rounded-md p-5 flex flex-col gap-10">
			{/* Заголовок секции */}
			<SectionHeader number={1} title="Данные покупателя" />

			{/* Поля формы */}
			<div className="flex flex-col gap-3">
				<FormField label="Имя" error={errors?.name}>
					<IInput
						type="text"
						value={data.name}
						placeholder="Иванов Иван Иванович"
						onChange={(e) => onChange({ name: e.target.value })}
					/>
				</FormField>

				<FormField label="Телефон" error={errors?.phone}>
					<IInput
						type="tel"
						value={data.phone}
						placeholder="+7 (987) 654-32-10"
						onChange={(e) => onChange({ phone: e.target.value })}
					/>
				</FormField>

				<FormField label="Email" error={errors?.email}>
					<IInput
						type="email"
						value={data.email}
						placeholder="yourown@gmail.com"
						onChange={(e) => onChange({ email: e.target.value })}
					/>
				</FormField>
			</div>
		</div>
	)
}

