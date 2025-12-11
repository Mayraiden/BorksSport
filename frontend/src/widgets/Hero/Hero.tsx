import Link from 'next/link'

export const Hero = () => {
	return (
		<section>
			<div className='lg:w-full lg:h-[87vh] lg:pt-42 bg-[url("/heroImage.jpg")] bg-center bg-cover md:pt-10 md:h-[80vh]'>
				<div className="max-w-[1040px] min-h-89 mx-auto pl-12 flex flex-col items-center justify-between md:justify-start md:gap-10">
					<div className="self-start">
						<h1 className="lg:text-7xl text-[#F5F5F5] font-bold select-none md:text-4xl">
							ТВОЙ СПОРТ
						</h1>
						<h1 className="lg:pl-10 lg:text-7xl text-gold font-bold select-none md:text-4xl md:pl-0">
							ТВОИ ПРАВИЛА
						</h1>
					</div>
					<div className="self-start">
						<p className="lg:pl-42 lg:text-[28px] text-[#F5F5F5] self-start select-none md:text-2xl md:pl-0">
							Премиальное спортивное снаряжение и одежда <br />
						</p>
						<p className="lg:pl-56 lg:text-[28px] text-[#F5F5F5] self-start select-none md:text-2xl md:pl-0">
							для чемпионов, кто не согласен на меньшее
						</p>
					</div>
					<Link
						href="/catalog"
						className="w-65 h-15 text-base flex items-center justify-center rounded-sm bg-gold lg:self-end hover:opacity-90 transition-opacity duration-200 md:self-start"
					>
						Перейти в каталог
					</Link>
				</div>
			</div>
		</section>
	)
}
