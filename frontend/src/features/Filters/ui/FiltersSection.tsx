'use client'

import { useState } from 'react'
import { CaretUpIcon, CaretDownIcon } from '@phosphor-icons/react/ssr'
import { IFilterRange } from '@shared/ui/FliterRange'
import { IFilterCheckbox } from '@shared/ui/FilterCheckBox'
import type {
	FilterSection as FilterSectionType,
	FilterValues,
	FilterValue,
} from '@shared/types/filters.types'

interface FilterSectionProps {
	section: FilterSectionType
	values: FilterValues
	onValuesChange: (values: FilterValues) => void
}

export const FilterSection = ({
	section,
	values,
	onValuesChange,
}: FilterSectionProps) => {
	const [isExpanded, setIsExpanded] = useState(section.expanded || false)

	const handleFilterChange = (filterId: string, newValue: FilterValue) => {
		onValuesChange({
			...values,
			[filterId]: newValue,
		})
	}

	const toggleExpanded = () => {
		setIsExpanded(!isExpanded)
	}

	return (
		<div className="pb-4 ">
			<button
				onClick={toggleExpanded}
				className="w-full flex items-center justify-between py-2 text-left"
			>
				<h3 className="text-base font-bold text-gray-900">{section.label}</h3>
				{isExpanded ? (
					<CaretUpIcon size={16} className="text-gray-500" />
				) : (
					<CaretDownIcon size={16} className="text-gray-500" />
				)}
			</button>

			{isExpanded && (
				<div className="space-y-4">
					{section.filters.map((filter) => {
						switch (filter.type) {
							case 'range':
								return (
									<IFilterRange
										key={filter.id}
										id={filter.id}
										label={filter.label}
										min={filter.min || 0}
										max={filter.max || 100}
										step={filter.step || 1}
										value={
											(values[filter.id] as { min: number; max: number }) ||
											(filter.default as { min: number; max: number }) || {
												min: 0,
												max: 0,
											}
										}
										onChange={(value) => handleFilterChange(filter.id, value)}
									/>
								)
							case 'checkbox':
								return (
									<IFilterCheckbox
										key={filter.id}
										id={filter.id}
										label={filter.label}
										options={filter.options || []}
										value={(values[filter.id] as string[]) || []}
										onChange={(value) => handleFilterChange(filter.id, value)}
									/>
								)
							default:
								return null
						}
					})}
				</div>
			)}
		</div>
	)
}
