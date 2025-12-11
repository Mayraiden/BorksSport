import Link from 'next/link'
import { Sports } from '@/shared/helpers/typesOfSport'

export const PopularSports = () => {
	return (
		<section className="w-screen px-20 pt-15">
			<h2 className="text-3xl font-bold mb-5">Популярные виды спорта</h2>

			<ul className="w-full grid grid-cols-5 gap-3 text-[#f5f5f5]">
				{Sports.map((item) => {
					return (
						<li
							key={item.id}
							className="h-59 pb-5 flex bg-center bg-no-repeat bg-[length:110%] hover:bg-size-[305] transition-[background-size]"
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
