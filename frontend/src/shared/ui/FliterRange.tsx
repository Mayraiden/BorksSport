'use client'

type IFilterRangeProps = {
	id: string
	label: string
	min: number
	max: number
	step: number
	value: { min: number; max: number }
	onChange: (value: { min: number; max: number }) => void
}
export const IFilterRange = ({
	id,
	min,
	max,
	step,
	value,
	onChange,
}: IFilterRangeProps) => {
	const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newMin = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
		onChange({ min: newMin, max: value.max })
	}

	const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newMax = e.target.value === '' ? 0 : parseInt(e.target.value) || 0
		onChange({ min: value.min, max: newMax })
	}

	return (
		<div className="space-y-3">
			<div className="pl-1 flex items-center">
				<input
					type="text"
					inputMode="numeric"
					id={`${id}-min`}
					min={min}
					max={max}
					step={step}
					value={value.min || ''}
					onChange={handleMinChange}
					placeholder="0"
					className="w-full px-3 py-2 border border-gray-300 rounded-l-md bg-gray/20 focus:outline-none focus:border-transparent"
				/>
				<input
					type="text"
					inputMode="numeric"
					id={`${id}-max`}
					min={min}
					max={max}
					step={step}
					value={value.max || ''}
					onChange={handleMaxChange}
					placeholder="0"
					className="w-full px-3 py-2 border border-gray-300 rounded-r-md bg-gray/20 focus:outline-none focus:border-transparent"
				/>
			</div>
		</div>
	)
}
