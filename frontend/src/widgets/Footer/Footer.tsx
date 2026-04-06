'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/ssr'
import { footerApi, type FooterSettings } from '@/features/Footer/api/footerApi'

const defaultSettings: FooterSettings = {
	companyName: 'ООО «Руспроект»',
	inn: '9715238760',
	ogrn: '1167746088586',
	legalAddress:
		'123007, г. Москва, вн.тер.г. муниципальный округ Хорошевский, проезд 2-й Хорошёвский, д. 7, стр. 16, ком 2',
	phone: '+7 (977) 697-21-77',
	telegramUrl: 'https://t.me/profisportrf',
	telegramLabel: 'Телеграмм канал',
	physicalAddress: 'г. Москва, Волгоградский проспект, дом 111',
	copyrightText: '© 2025 ПРОФСПОРТ. Все права защищены.',
}

export const Footer = () => {
	const [settings, setSettings] = useState<FooterSettings>(defaultSettings)

	useEffect(() => {
		footerApi.getFooterSettings().then(setSettings)
	}, [])

	return (
		<footer className="w-screen px-20 mt-auto flex flex-col bg-black text-white max-sm:px-2 max-sm:pb-20">
			<div className="flex pt-10 pb-10 border-b border-white/30 max-sm:flex-col max-sm:gap-6 max-sm:pt-4 max-sm:pb-4">
				<div className="flex-1 max-sm:w-full">
					<h3 className="text-lg font-bold mb-4 max-sm:text-base max-sm:mb-2">
						О компании
					</h3>
					<div className="flex flex-col gap-2 text-white/60 max-sm:gap-1.5 max-sm:text-sm">
						<p>{settings.companyName}</p>
						<p>ИНН: {settings.inn}</p>
						<p>ОГРН: {settings.ogrn}</p>
						<p>Адрес: {settings.legalAddress}</p>
					</div>
				</div>
				<div className="flex-1 flex flex-col gap-2 max-sm:w-full max-sm:gap-1.5">
					<h3 className="text-lg font-bold mb-2 max-sm:text-base max-sm:mb-2">
						Контакты
					</h3>
					<p className="text-white/60 max-sm:text-sm">{settings.phone}</p>
					<Link
						className="flex gap-1 items-center text-white/60 max-sm:text-sm"
						href={settings.telegramUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						<PaperPlaneTiltIcon size={20} className="max-sm:w-4 max-sm:h-4" />
						<span>{settings.telegramLabel}</span>
					</Link>
					<p className="text-white/60 max-sm:text-sm">
						{settings.physicalAddress}
					</p>
				</div>
			</div>
			<div className="py-10 flex justify-between items-center text-white/60 max-sm:flex-col max-sm:gap-4 max-sm:py-4 max-sm:items-start max-sm:text-sm">
				<p>{settings.copyrightText}</p>
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
