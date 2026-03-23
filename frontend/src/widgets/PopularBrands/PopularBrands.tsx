'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { categoryApi } from '@/features/Filters/api/categoryApi'

const API_URL =
	process.env.NEXT_PUBLIC_STRAPI_URL ||
	process.env.NEXT_STRAPI_URL ||
	'http://localhost:1337'

const getMediaUrl = (url?: string): string | null => {
	if (!url) return null
	if (url.startsWith('http://') || url.startsWith('https://')) return url
	return `${API_URL}${url}`
}

export const PopularBrands = () => {
	const { data: brands = [] } = useQuery({
		queryKey: ['brands', 'home'],
		queryFn: () => categoryApi.getHomeBrands(15),
		staleTime: 5 * 60 * 1000,
		gcTime: 30 * 60 * 1000,
		refetchOnWindowFocus: false,
	})

	if (brands.length === 0) {
		return null
	}

	return (
		<section className="w-full pb-15 pt-18 px-20 max-sm:pt-4 max-sm:px-2">
			<h2 className="text-3xl font-bold mb-5 max-sm:text-2xl max-sm:mb-2 text-left">
				Популярные бренды
			</h2>
			<ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 max-sm:gap-2.5">
				{brands.map((brand) => {
					const logoUrl = getMediaUrl(brand.logo?.url)
					const href = `/catalog?brand=${encodeURIComponent(brand.name)}`

					return (
						<li key={brand.id} className="w-full h-[200px] overflow-hidden max-sm:max-w-none">
							<Link
								href={href}
								className="bg-[#000000] flex items-center justify-center w-full h-full"
								aria-label={`Бренд ${brand.name}`}
							>
								{logoUrl ? (
									<Image
										className="object-contain w-full h-full"
										src={logoUrl}
										alt={brand.logo?.alternativeText || `Логотип ${brand.name}`}
										width={246}
										height={200}
									/>
								) : (
									<span className="px-3 text-center text-white text-xl font-semibold uppercase break-words">
										{brand.name}
									</span>
								)}
							</Link>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
