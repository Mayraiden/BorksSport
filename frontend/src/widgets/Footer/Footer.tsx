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
		'109117, г. Москв, вн.тер.г. Муниципальный округ Кузьминки, пр-кт Волгоградский, д.111, помещ.2Н',
	phone: '+7 (965) 262-14-24',
	email: 'mblmos@yandex.ru',
	telegramUrl: 'https://t.me/profisportrf',
	telegramLabel: 'Наш телеграм',
	physicalAddress: 'г. Москва, Волгоградский проспект, дом 111',
	physicalAddressMapUrl:
		'https://yandex.ru/maps/?text=%D0%B3.%20%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%2C%20%D0%92%D0%BE%D0%BB%D0%B3%D0%BE%D0%B3%D1%80%D0%B0%D0%B4%D1%81%D0%BA%D0%B8%D0%B9%20%D0%BF%D1%80%D0%BE%D1%81%D0%BF%D0%B5%D0%BA%D1%82%2C%20%D0%B4%D0%BE%D0%BC%20111',
	workModeText: 'Уточняйте по телефону',
	copyrightText: '© 2025 ПРОФСПОРТ. Все права защищены.',
}

export const Footer = () => {
	const [settings, setSettings] = useState<FooterSettings>(defaultSettings)

	useEffect(() => {
		footerApi.getFooterSettings().then(setSettings)
	}, [])

	const telHref = `tel:${(settings.phone || '').replace(/[^\d+]/g, '')}`

	return (
		<footer className="w-screen px-20 mt-auto flex flex-col bg-black text-white max-sm:px-2 max-sm:pb-20">
			<div className="flex pt-10 pb-10 border-b border-white/30 max-sm:flex-col max-sm:gap-6 max-sm:pt-4 max-sm:pb-4">
				<div className="flex-1 max-sm:w-full">
					<h3 className="text-lg font-bold mb-4 max-sm:text-base max-sm:mb-2">
						О компании
					</h3>
					<div className="flex flex-col gap-2 text-white/60 max-sm:gap-1.5 max-sm:text-sm">
						<p className="text-white">{settings.companyName}</p>
						<p>ИНН: {settings.inn}</p>
						<p>ОГРН: {settings.ogrn}</p>
						<div className="pt-1">
							<p className="text-xs uppercase tracking-wide text-white/50">Юр. адрес</p>
							<p className="break-words leading-relaxed">{settings.legalAddress}</p>
						</div>
					</div>
				</div>
				<div className="flex-1 flex flex-col gap-2 max-sm:w-full max-sm:gap-1.5">
					<h3 className="text-lg font-bold mb-2 max-sm:text-base max-sm:mb-2">
						Контакты
					</h3>
					<a className="text-white/60 max-sm:text-sm hover:text-white transition-colors" href={telHref}>
						{settings.phone}
					</a>
					<a
						className="text-white/60 max-sm:text-sm hover:text-white transition-colors"
						href={`mailto:${settings.email}`}
					>
						{settings.email}
					</a>
					<Link
						className="flex gap-1 items-center text-white/60 max-sm:text-sm hover:text-white transition-colors"
						href={settings.telegramUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						<PaperPlaneTiltIcon size={20} className="max-sm:w-4 max-sm:h-4" />
						<span>{settings.telegramLabel}</span>
					</Link>
					<div className="pt-1">
						<p className="text-xs uppercase tracking-wide text-white/50">Факт. адрес</p>
						<a
							className="text-white/60 max-sm:text-sm hover:text-white transition-colors break-words leading-relaxed"
							href={settings.physicalAddressMapUrl}
							target="_blank"
							rel="noopener noreferrer"
						>
							{settings.physicalAddress}
						</a>
					</div>
					<div className="pt-1">
						<p className="text-xs uppercase tracking-wide text-white/50">Режим работы</p>
						<p className="text-white/60 max-sm:text-sm">{settings.workModeText}</p>
					</div>
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
