export default ({ env }) => {
  const isDevelopment = env('NODE_ENV', 'production') === 'development';

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    // Для Strapi v5 используйте объект
    proxy: !isDevelopment ? { koa: true } : false,
    url: env(
      'PUBLIC_URL',
      !isDevelopment ? 'https://api.borkssport.ru' : 'http://localhost:1337'
    ),
    app: {
      keys: env.array('APP_KEYS'),
    },
    allowedHosts: !isDevelopment
      ? ['api.borkssport.ru', 'borkssport.ru', 'www.borkssport.ru']
      : ['localhost', '127.0.0.1', '0.0.0.0'],
    cron: {
      enabled: true,
      tasks: {
        /**
         * Periodic safety sync for CDEK delivery statuses.
         * Webhook-first, cron is a fallback when webhooks are missed.
         */
        cdekStatusSync: {
          task: async ({ strapi }) => {
            const mapCdekStatusToOrderStatus = (rawStatus) => {
              const value = String(rawStatus ?? '').trim()
              if (!value) return undefined
              const normalized = value.toLowerCase()
              if (
                normalized.includes('delivered') ||
                normalized.includes('handed') ||
                normalized.includes('received') ||
                normalized.includes('вручен') ||
                normalized.includes('доставлен')
              ) {
                return 'delivered'
              }
              if (
                normalized.includes('shipped') ||
                normalized.includes('in_transit') ||
                normalized.includes('transit') ||
                normalized.includes('accepted') ||
                normalized.includes('created') ||
                normalized.includes('pickup') ||
                normalized.includes('передан') ||
                normalized.includes('принят') ||
                normalized.includes('в пути') ||
                normalized.includes('отправ')
              ) {
                return 'shipped'
              }
              return undefined
            }

            try {
              const cdekService = strapi.service('api::cdek-sync.cdek-sync')

              const orders = await strapi.entityService.findMany('api::order.order', {
                filters: {
                  deliveryType: { $ne: 'pickup' },
                  status: { $in: ['paid', 'shipped'] },
                  cdekTrackNumber: { $notNull: true },
                },
                sort: 'updatedAt:asc',
                limit: 50,
              })

              for (const order of orders) {
                const trackNumber = order.cdekTrackNumber
                if (!trackNumber) continue
                try {
                  const tracked = await cdekService.trackOrder(trackNumber)
                  const nextCdekStatus =
                    tracked?.entity?.status ||
                    tracked?.entity?.state ||
                    tracked?.status ||
                    null
                  const nextOrderStatus = mapCdekStatusToOrderStatus(nextCdekStatus)

                  await strapi.entityService.update('api::order.order', order.id, {
                    data: {
                      ...(nextCdekStatus ? { cdekStatus: String(nextCdekStatus) } : {}),
                      ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
                    },
                  })
                } catch (e) {
                  // keep going; do not fail the whole cron task
                  strapi.log.warn('CDEK cron sync failed for order', {
                    orderId: order.id,
                    error: e?.message || String(e),
                  })
                }
              }
            } catch (e) {
              strapi.log.error('CDEK cron sync task failed', e)
            }
          },
          options: {
            // Every 30 minutes
            rule: '*/30 * * * *',
          },
        },
      },
    },
  };
};