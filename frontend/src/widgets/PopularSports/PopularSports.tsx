import Link from 'next/link'
import { Sports } from '@/shared/helpers/typesOfSport'

export const PopularSports = () => {
	return (
		<section className="w-full px-20 pt-15 max-sm:px-2 max-sm:pt-4">
			<h2 className="text-3xl font-bold mb-5 max-sm:text-2xl">
				Популярные виды спорта
			</h2>

			<ul className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-[#f5f5f5] max-sm:gap-3">
				{Sports.map((item) => {
					return (
						<li
							key={item.id}
							className={`h-59 pb-5 flex bg-center bg-no-repeat bg-[length:110%] hover:bg-size-[305] transition-[background-size] max-sm:h-40`}
							style={{ backgroundImage: `url('${item.image}')` }}
						>
							<Link
								href="/"
								className="w-full h-full text-center flex justify-center"
							>
								<div className="self-end">{item.title}</div>
							</Link>
						</li>
					)
				})}
			</ul>
		</section>
	)
}
