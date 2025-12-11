'use client'

type SectionHeaderProps = {
	number: number
	title: string
	className?: string
}

export const SectionHeader = ({
	number,
	title,
	className = '',
}: SectionHeaderProps) => {
	return (
		<div className={`flex items-center gap-2 ${className}`}>
			{/* Черный кружок с цифрой */}
			<div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
				<div className="w-5 h-5 rounded-full bg-black border-[1.5px] border-white flex items-center justify-center">
					<span className="text-[10px] font-normal text-white leading-none">
						{number}
					</span>
				</div>
			</div>
			<h3 className="text-base font-bold leading-[1.3125] text-black">{title}</h3>
		</div>
	)
}

