import Image from 'next/image'

const BRANDS_NEW = [
	{ src: '/brandsNew/wilson.png', alt: 'Wilson' },
	{ src: '/brandsNew/Alfa.jpg', alt: 'Alfa' },
]

export const PopularBrands = () => {
	return (
		<section className="w-full pb-15 pt-18 px-20 max-sm:pt-4 max-sm:px-2">
			<h2 className="text-3xl font-bold mb-5 max-sm:text-2xl max-sm:mb-2 text-left">
				Популярные бренды
			</h2>
			<ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 max-sm:gap-2.5">
				{BRANDS_NEW.map((brand) => (
					<li
						key={brand.src}
						className="bg-[#000000] flex items-center justify-center w-full h-[200px] overflow-hidden max-sm:max-w-none"
					>
						<Image
							className="object-contain w-full h-full"
							src={brand.src}
							alt={brand.alt}
							width={246}
							height={200}
						/>
					</li>
				))}
			</ul>
		</section>
	)
}
