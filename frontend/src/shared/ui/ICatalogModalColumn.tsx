import { ICatalogModalLink } from './ICatalogModalLink'

type ICatalogModalColumnProps = {
	title: string
	links: Array<{ href: string; text: string }>
}

export const ICatalogModalColumn = ({
	title,
	links,
}: ICatalogModalColumnProps) => {
	return (
		<div className="p-5 border-r-1 border-inherit">
			<h1 className="mb-5 text-base font-bold">{title}</h1>
			<ul className="flex flex-col gap-1">
				{links.map((link) => {
					return (
						<li key={Math.random()}>
							<ICatalogModalLink href={link.href} text={link.text} />
						</li>
					)
				})}
			</ul>
		</div>
	)
}
