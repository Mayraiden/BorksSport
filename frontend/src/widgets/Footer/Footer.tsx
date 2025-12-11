import Image from 'next/image'
import Link from 'next/link'
import { TelegramLogoIcon } from '@phosphor-icons/react/ssr'

export const Footer = () => {
	return (
		<footer className="w-screen px-10 mt-auto flex flex-col bg-black text-white">
			<div className="flex pt-10 pb-10 border-b border-white/30">
				<div className="w-100 mr-10">
					<Link href="/" className="h-10 flex items-center gap-2">
						<Image
							src="/logo.svg"
							width={250}
							height={20}
							alt="логотип BORKS"
						/>
					</Link>
					<p className="w-80 text-white/60">
						ООО &laquo;РУСПРОЕКТ&raquo;, ИНН: 9715238760, ОГРН: 1167746088586,
						Адрес: 123007, г. Москва, вн.тер.г. муниципальный округ Хорошевский,
						проезд 2-й Хорошёвский, д.&nbsp;7, стр.&nbsp;16, ком&nbsp;2
					</p>
				</div>
				<div className="flex flex-col gap-2">
					<h3 className="text-lg font-bold">Контакты</h3>
					<p className="text-white/60">+7 (977) 697-21-77</p>
					<Link className="flex gap-1 items-center text-white/60" href="/">
						<TelegramLogoIcon size={20} />
						<span>Телеграм канал</span>
					</Link>
					<p className="text-white/60">
						г. Москва, Волгоградский проспект, дом 111
					</p>
				</div>
			</div>
			<div className="py-10 flex justify-between items-center text-white/60">
				<p>© 2025 ПРОФСПОРТ. Все права защищены.</p>
				<div>
					<ul className="flex gap-3">
						<li>
							<Link href="/privacy">Политика конфиденциальности</Link>
						</li>
						<li>
							<Link href="/oferta">Договор оферта</Link>
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
