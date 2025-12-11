import Image from 'next/image'

export const PopularBrands = () => {
	return (
		<section className="max-w-[1280px] mx-auto pb-15 pt-18">
			<h2 className="text-3xl font-bold mb-5">Популярные бренды</h2>
			<ul className="grid grid-cols-4 grid-rows-2 gap-3">
				<li className="w-78 h-50 bg-black flex items-center justify-center">
					<Image
						className="brightness-0 invert"
						src="/brands/adidas.svg"
						alt="logo"
						width={200}
						height={200}
					/>
				</li>
				<li className="bg-black flex items-center justify-center">
					<Image
						className="brightness-0 invert"
						src="/brands/asics.svg"
						alt="logo"
						width={200}
						height={200}
					/>
				</li>
				<li className="bg-black flex items-center justify-center">
					<Image
						className="brightness-0 invert"
						src="/brands/babolat.svg"
						alt="logo"
						width={200}
						height={200}
					/>
				</li>
				<li className="bg-black flex items-center justify-center">
					<Image
						className="brightness-0 invert"
						src="/brands/jordan.svg"
						alt="logo"
						width={200}
						height={200}
					/>
				</li>
				<li className="bg-black flex items-center justify-center">
					<Image
						className="brightness-0 invert"
						src="/brands/mizuno.svg"
						alt="logo"
						width={200}
						height={200}
					/>
				</li>
				<li className="bg-black flex items-center justify-center">
					<Image
						className="brightness-0 invert"
						src="/brands/new-balance.svg"
						alt="logo"
						width={200}
						height={200}
					/>
				</li>
				<li className="bg-black flex items-center justify-center">
					<Image
						className="brightness-0 invert"
						src="/brands/nike.svg"
						alt="logo"
						width={200}
						height={200}
					/>
				</li>
				<li className="bg-black flex items-center justify-center">
					<Image
						className="brightness-0 invert"
						src="/brands/reebok.svg"
						alt="logo"
						width={200}
						height={200}
					/>
				</li>
			</ul>
		</section>
	)
}
