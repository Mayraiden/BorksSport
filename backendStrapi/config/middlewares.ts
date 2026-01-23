export default [
	'strapi::logger',
	'strapi::errors',
	'strapi::security',
	'strapi::cors',
	'strapi::poweredBy',
	'strapi::query',
	'global::commerceml-xml-body', // Кастомный middleware для raw XML (должен быть ДО strapi::body)
	'strapi::body',
	'strapi::session',
	'strapi::favicon',
	'strapi::public',
]
