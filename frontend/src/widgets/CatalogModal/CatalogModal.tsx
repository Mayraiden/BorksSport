import { ICatalogModalColumn } from '@/shared/ui/ICatalogModalColumn'
import Link from 'next/link'

type ICatalogModalProps = {
	isOpen: boolean
	onClose: () => void
}

const catalogData = [
	{
		title: 'Виды спорта',
		links: [
			{ href: '/catalog', text: 'Теннис' },
			{ href: '/catalog', text: 'Баскетбол' },
			{ href: '/catalog', text: 'Волейбол' },
			{ href: '/catalog', text: 'Бадминтон' },
			{ href: '/catalog', text: 'Сквош' },
			{ href: '/catalog', text: 'Футбол' },
		],
	},
	{
		title: 'Категории',
		links: [
			{ href: '/catalog', text: 'Одежда' },
			{ href: '/catalog', text: 'Обувь' },
			{ href: '/catalog', text: 'Инвентарь' },
			{ href: '/catalog', text: 'Аксессуары' },
		],
	},
	{
		title: 'Бренды',
		links: [
			{ href: '/catalog', text: 'Nike' },
			{ href: '/catalog', text: 'Adidas' },
			{ href: '/catalog', text: 'New Balance' },
			{ href: '/catalog', text: 'Mizuno' },
			{ href: '/catalog', text: 'Anta' },
		],
	},
]

export const CatalogModal = ({ isOpen, onClose }: ICatalogModalProps) => {
	if (!isOpen) return null

	return (
		<>
			{/* Overlay для закрытия по клику вне модала */}
			<div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

			<aside className="absolute left-0 top-20 w-screen min-h-3/4 p-5 flex flex-col justify-between bg-white shadow-lg z-50">
				<div className="h-full grid grid-cols-6 border border-gray/20">
					{catalogData.map((section) => (
						<ICatalogModalColumn
							key={Math.random()}
							title={section.title}
							links={section.links}
						/>
					))}
				</div>
				<div className="flex gap-5 items-center">
					<Link
						className="h-10 py-4 px-6 flex items-center border-1 border-gray/20 rounded-md hover:bg-alt-white transition-colors"
						href={'/catalog'}
					>
						смотреть все товары
					</Link>
				</div>
			</aside>
		</>
	)
}
