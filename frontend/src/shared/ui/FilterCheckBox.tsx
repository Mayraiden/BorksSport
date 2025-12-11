'use client'

import { Checkbox } from './Checkbox'

type IFilterCheckboxProps = {
	id: string
	label: string
	options: Array<{ value: string; label: string; id?: number | string }>
	value: string[]
	onChange: (value: string[]) => void
}

export const IFilterCheckbox = ({
	options,
	value,
	onChange,
}: IFilterCheckboxProps) => {
	const handleOptionChange = (optionValue: string) => {
		const newValue = value.includes(optionValue)
			? value.filter((v) => v !== optionValue)
			: [...value, optionValue]
		onChange(newValue)
	}

	return (
		<div className="space-y-3">
			<div className="space-y-2">
				{options.map((option, index) => (
					<Checkbox
						// Используем id если есть, иначе комбинацию индекса и значения для уникальности
						key={option.id ? `category-${option.id}` : `option-${index}-${option.value}`}
						checked={value.includes(option.value)}
						onChange={() => handleOptionChange(option.value)}
						size="md"
					>
						{option.label}
					</Checkbox>
				))}
			</div>
		</div>
	)
}
