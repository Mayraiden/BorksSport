import type { StrapiApp } from '@strapi/strapi/admin'
import ruTranslations from './translations/ru.json'
import ClearCollectionButton from './components/ClearCollectionButton'
import SyncProductsButton from './components/SyncProductsButton'

export default {
	config: {
		locales: ['ru', 'en'],
		messages: {
			ru: ruTranslations,
		},
	},
	bootstrap(app: StrapiApp) {
		console.log('Strapi admin app bootstrapped')
		console.log(
			'Russian translations loaded:',
			Object.keys(ruTranslations).length,
			'keys'
		)

		// Инъекция кнопки в список записей каждой коллекции через Content Manager API
		// Совместимо с актуальным API плагина
		// @ts-ignore
		const cm = app.getPlugin && app.getPlugin('content-manager')
		// @ts-ignore
		cm?.injectComponent?.('listView', 'actions', {
			name: 'clear-collection',
			// передаем готовый компонент
			Component: ClearCollectionButton,
		})
		// Кнопка синхронизации товаров из СБИС (показывается только для products)
		// @ts-ignore
		cm?.injectComponent?.('listView', 'actions', {
			name: 'sync-products',
			Component: SyncProductsButton,
		})
	},
}

