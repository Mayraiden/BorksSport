import Link from 'next/link'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/ssr'

export const Footer = () => {
	return (
		<footer className="w-screen px-20 mt-auto flex flex-col bg-black text-white max-sm:px-2 max-sm:pb-20">
			<div className="flex pt-10 pb-10 border-b border-white/30 max-sm:flex-col max-sm:gap-6 max-sm:pt-4 max-sm:pb-4">
				<div className="flex-1 max-sm:w-full">
					<h3 className="text-lg font-bold mb-4 max-sm:text-base max-sm:mb-2">
						О компании
					</h3>
					<div className="flex flex-col gap-2 text-white/60 max-sm:gap-1.5 max-sm:text-sm">
						<p>ООО &laquo;Руспроект&raquo;</p>
						<p>ИНН: 9715238760</p>
						<p>ОГРН: 1167746088586</p>
						<p>
							Адрес: 123007, г. Москва, вн.тер.г. муниципальный округ
							Хорошевский, проезд 2-й Хорошёвский, д.&nbsp;7, стр.&nbsp;16,
							ком&nbsp;2
						</p>
					</div>
				</div>
				<div className="flex-1 flex flex-col gap-2 max-sm:w-full max-sm:gap-1.5">
					<h3 className="text-lg font-bold mb-2 max-sm:text-base max-sm:mb-2">
						Контакты
					</h3>
					<p className="text-white/60 max-sm:text-sm">+7 (977) 697-21-77</p>
					<Link
						className="flex gap-1 items-center text-white/60 max-sm:text-sm"
						href="https://t.me/profisportrf"
						target="_blank"
						rel="noopener noreferrer"
					>
						<PaperPlaneTiltIcon size={20} className="max-sm:w-4 max-sm:h-4" />
						<span>Телеграмм канал</span>
					</Link>
					<p className="text-white/60 max-sm:text-sm">
						г. Москва, Волгоградский проспект, дом 111
					</p>
				</div>
			</div>
			<div className="py-10 flex justify-between items-center text-white/60 max-sm:flex-col max-sm:gap-4 max-sm:py-4 max-sm:items-start max-sm:text-sm">
				<p>© 2025 ПРОФСПОРТ. Все права защищены.</p>
				<div className="max-sm:w-full">
					<ul className="flex gap-3 max-sm:flex-col max-sm:gap-2">
						<li>
							<Link href="/privacy">Политика конфиденциальности</Link>
						</li>
						<li>
							<Link href="/oferta">Договор-оферта</Link>
						</li>
						<li>
							<Link href="/cookies">Файлы куки</Link>
						</li>
					</ul>
				</div>
			</div>
		</footer>
	)
}
