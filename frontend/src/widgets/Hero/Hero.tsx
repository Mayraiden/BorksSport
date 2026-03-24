import Link from 'next/link'

type HeroProps = {
	title?: string | null
	imageUrl?: string | null
}

const DEFAULT_TITLE = 'ТВОЙ СПОРТ\nТВОИ ПРАВИЛА'

export const Hero = ({ title, imageUrl }: HeroProps) => {
	const headingText = title?.trim() || DEFAULT_TITLE
	const headingLines = headingText.split('\n').filter(Boolean)
	const heroBackgroundStyle = imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined

	return (
		<section>
			<div
				className='lg:w-full lg:h-[87vh] lg:pt-42 bg-[url("/heroImage.jpg")] bg-center bg-cover md:py-10 md:h-full max-sm:py-10 max-sm:h-[64vh]'
				style={heroBackgroundStyle}
			>
				<div className="max-w-[1040px] mx-auto pl-12 flex flex-col items-center justify-between md:justify-start md:gap-10 max-sm:gap-10 max-sm:p-2">
					<div className="self-start max-sm:self-start max-sm:text-left">
						{headingLines.map((line, index) => (
							<h1
								key={`${line}-${index}`}
								className={`lg:text-7xl font-bold select-none md:text-4xl max-sm:text-4xl ${
									index === 0
										? 'text-[#F5F5F5]'
										: 'lg:pl-10 text-gold md:pl-0'
								}`}
							>
								{line}
							</h1>
						))}
					</div>
					<div className="self-start max-sm:self-center max-sm:text-left">
						<p className="lg:pl-42 lg:text-[28px] text-[#F5F5F5] self-start select-none md:text-2xl md:pl-0 max-sm:text-2xl max-sm:mb-2">
							Премиальное спортивное снаряжение и одежда <br />
						</p>
						<p className="lg:pl-56 lg:text-[28px] text-[#F5F5F5] self-start select-none md:text-2xl md:pl-0 max-sm:text-2xl">
							для чемпионов, кто не согласен на меньшее
						</p>
					</div>
					<Link
						href="/catalog"
						className="w-65 h-15 text-base flex items-center justify-center rounded-sm bg-gold lg:self-end hover:opacity-90 transition-opacity duration-200 md:self-start max-sm:self-start"
					>
						Перейти в каталог
					</Link>
				</div>
			</div>
		</section>
	)
}
