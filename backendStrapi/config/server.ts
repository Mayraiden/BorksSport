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
         * Hourly SBIS catalog sync.
         * Uses the same in-process lock as manual sync to avoid overlapping runs.
         */
        sbisCatalogSync: {
          task: async ({ strapi }) => {
            const enabled = String(process.env.SBIS_SYNC_CRON_ENABLED ?? 'true').toLowerCase()
            if (!['1', 'true', 'yes', 'on'].includes(enabled)) {
              return
            }

            const { acquireSyncLock, releaseSyncLock, getActiveSyncRun } = await import('../src/utils/sync-lock')
            const lock = acquireSyncLock('sbis-api')
            if (lock.ok === false) {
              strapi.log.warn('SBIS cron sync skipped: sync is already running', {
                active: lock.active,
              })
              return
            }

            try {
              strapi.log.info('SBIS cron sync started')
              const summary = await strapi.service('api::sync-control.sync-control').runSbisCatalogSync()
              strapi.log.info('SBIS cron sync finished', { summary })
            } catch (e) {
              strapi.log.error('SBIS cron sync failed', {
                error: e?.message || String(e),
                active: getActiveSyncRun(),
              })
            } finally {
              releaseSyncLock(lock.run.token)
            }
          },
          options: {
            // Every 60 minutes
            rule: '0 * * * *',
          },
        },
        /**
         * Expire unpaid online orders (awaiting_payment) after reservedUntil.
         * Variant B: does not affect product stock; only cancels stale orders.
         */
        expireUnpaidOrders: {
          task: async ({ strapi }) => {
            const stockOps = (await import('../src/shared/stock/stock-ops')).default({ strapi })
            try {
              const nowIso = new Date().toISOString()
              const orders = await strapi.entityService.findMany('api::order.order', {
                filters: {
                  status: { $eq: 'awaiting_payment' },
                  reservedUntil: { $notNull: true, $lte: nowIso },
                },
                sort: 'reservedUntil:asc',
                limit: 200,
              })

              for (const order of orders) {
                try {
                  await strapi.db.transaction(async ({ trx }) => {
                    await stockOps.applyOrderStockOp({
                      trx,
                      orderId: order.id,
                      kind: 'release',
                    })

                    await strapi.entityService.update('api::order.order', order.id, {
                      data: {
                        status: 'cancelled',
                        cancelReason: 'Не оплачен в течение 30 минут',
                        cancelledAt: new Date().toISOString(),
                      },
                    })
                  })
                } catch (e) {
                  strapi.log.warn('expireUnpaidOrders: failed to cancel order', {
                    orderId: order.id,
                    error: e?.message || String(e),
                  })
                }
              }
            } catch (e) {
              strapi.log.error('expireUnpaidOrders task failed', e)
            }
          },
          options: {
            // Every 2 minutes
            rule: '*/2 * * * *',
          },
        },
        /**
         * Safety net: release stuck reserves for cancelled unpaid orders.
         * This protects against edge-cases when order got cancelled but reserve wasn't released.
         */
        releaseStuckCancelledReserves: {
          task: async ({ strapi }) => {
            const stockOps = (await import('../src/shared/stock/stock-ops')).default({ strapi })
            const knex = strapi.db.connection
            try {
              const ids: Array<{ id: number }> = await knex('orders')
                .select('id')
                .where({ status: 'cancelled' })
                .whereNotNull('reserved_until')
                // best-effort JSON checks (Postgres jsonb)
                .whereRaw("COALESCE(stock_ops->>'committedAt','') = ''")
                .whereRaw("COALESCE(stock_ops->>'releasedAt','') = ''")
                .orderBy('updated_at', 'asc')
                .limit(200)

              for (const row of ids) {
                try {
                  await strapi.db.transaction(async ({ trx }) => {
                    await stockOps.applyOrderStockOp({
                      trx,
                      orderId: row.id,
                      kind: 'release',
                    })
                  })
                } catch (e) {
                  strapi.log.warn('releaseStuckCancelledReserves: failed to release', {
                    orderId: row.id,
                    error: e?.message || String(e),
                  })
                }
              }
            } catch (e) {
              strapi.log.error('releaseStuckCancelledReserves task failed', e)
            }
          },
          options: {
            // Every 5 minutes
            rule: '*/5 * * * *',
          },
        },
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
        /**
         * Periodic sync for CDEK track numbers by cdekOrderUuid.
         * This is needed because cdek_number may appear later than initial CREATE.
         */
        cdekTrackSync: {
          task: async ({ strapi }) => {
            const extractTrackNumber = (payload: any): string | null => {
              const entity = payload?.entity || payload
              const candidate =
                entity?.cdek_number ||
                entity?.cdekNumber ||
                entity?.track_number ||
                entity?.trackNumber ||
                entity?.number ||
                entity?.cdekNumber?.value
              if (!candidate) return null
              const value = String(candidate).trim()
              return value ? value : null
            }

            try {
              const cdekService = strapi.service('api::cdek-sync.cdek-sync')
              const orders = await strapi.entityService.findMany('api::order.order', {
                filters: {
                  deliveryType: { $ne: 'pickup' },
                  cdekOrderUuid: { $notNull: true },
                  cdekTrackNumber: { $null: true },
                  status: { $in: ['awaiting_payment', 'paid', 'shipped'] },
                },
                sort: 'updatedAt:asc',
                limit: 50,
              })

              for (const order of orders) {
                const uuid = order.cdekOrderUuid
                if (!uuid) continue
                try {
                  const info = await cdekService.getOrderByUuid(uuid)
                  const track = extractTrackNumber(info)
                  const nextStatus =
                    (info as any)?.entity?.status ||
                    (info as any)?.entity?.state ||
                    null

                  if (track || nextStatus) {
                    await strapi.entityService.update('api::order.order', order.id, {
                      data: {
                        ...(track ? { cdekTrackNumber: track } : {}),
                        ...(nextStatus ? { cdekStatus: String(nextStatus) } : {}),
                      },
                    })
                  }
                } catch (e) {
                  strapi.log.warn('cdekTrackSync: failed to sync order', {
                    orderId: order.id,
                    cdekOrderUuid: uuid,
                    error: e?.message || String(e),
                  })
                }
              }
            } catch (e) {
              strapi.log.error('cdekTrackSync task failed', e)
            }
          },
          options: {
            // Every 10 minutes
            rule: '*/10 * * * *',
          },
        },
        /**
         * Fallback: reconcile pending refunds when webhooks are missed.
         * If a refund was requested for a paid order, stock is returned only after the refund is confirmed.
         * This task periodically checks payment status and finalizes refund side-effects (order cancelled + stock return).
         */
        reconcilePendingRefunds: {
          task: async ({ strapi }) => {
            const stockOps = (await import('../src/shared/stock/stock-ops')).default({ strapi })
            const tochkaPayService = strapi.service('api::payment.tochka-pay')

            const mapRefunded = (raw: unknown): boolean => {
              const s = String(raw ?? '').toLowerCase()
              return (
                s === 'refunded' ||
                s.includes('refund') && (s.includes('success') || s.includes('succeed') || s.includes('approved') || s.includes('completed')) ||
                s.includes('reversed')
              )
            }

            try {
              const candidates = await strapi.entityService.findMany('api::payment.payment', {
                filters: {
                  refundStatus: { $eq: 'pending' },
                },
                populate: ['order'],
                sort: 'updatedAt:asc',
                limit: 100,
              })

              for (const payment of candidates) {
                const order = (payment as any)?.order
                if (!order) continue
                const orderId = Number(order.id || 0)
                if (!orderId) continue

                // Only for orders that were paid and are not yet cancelled.
                const orderStatus = String(order.status || '')
                if (orderStatus === 'cancelled') {
                  continue
                }
                if (orderStatus !== 'paid') {
                  continue
                }

                const statusIdentifier = (payment as any).sessionId || (payment as any).paymentId
                if (!statusIdentifier) continue

                try {
                  const statusResponse = await tochkaPayService.getPaymentStatus(statusIdentifier)
                  const isRefunded = mapRefunded(statusResponse?.status)
                  if (!isRefunded) continue

                  await strapi.db.transaction(async ({ trx }) => {
                    await stockOps.applyOrderStockOp({
                      trx,
                      orderId,
                      kind: 'return',
                    })

                    await strapi.entityService.update('api::order.order', orderId, {
                      data: {
                        status: 'cancelled',
                        cancelledAt: new Date().toISOString(),
                        cancelReason:
                          (order as any).cancelReason || 'Отменено: возврат средств подтверждён (poll)',
                      },
                    })

                    await strapi.entityService.update('api::payment.payment', (payment as any).id, {
                      data: {
                        status: 'refunded',
                        refundStatus: 'succeeded',
                        refundedAt: new Date().toISOString(),
                      },
                    })
                  })
                } catch (e) {
                  strapi.log.warn('reconcilePendingRefunds: failed to reconcile payment', {
                    paymentId: (payment as any).id,
                    orderId,
                    error: e?.message || String(e),
                  })
                }
              }
            } catch (e) {
              strapi.log.error('reconcilePendingRefunds task failed', e)
            }
          },
          options: {
            // Every 5 minutes
            rule: '*/5 * * * *',
          },
        },
        /**
         * Fallback sync for Tochka refunds (when webhooks are missing).
         * Looks for payments with refundStatus=pending and updates Payment/Order when refund is completed.
         */
        tochkaRefundSync: {
          task: async ({ strapi }) => {
            const normalize = (raw) => String(raw ?? '').trim().toLowerCase()
            const isRefundSucceeded = (rawStatus) => {
              const s = normalize(rawStatus)
              return (
                s === 'refunded' ||
                s === 'refund' ||
                s.includes('refunded') ||
                s.includes('refund') && (s.includes('success') || s.includes('succeed')) ||
                s.includes('completed') ||
                s.includes('approved')
              )
            }
            const isRefundFailed = (rawStatus) => {
              const s = normalize(rawStatus)
              return (
                s.includes('failed') ||
                s.includes('declined') ||
                s.includes('rejected') ||
                s.includes('error')
              )
            }

            try {
              const tochkaPayService = strapi.service('api::payment.tochka-pay')

              const payments = await strapi.entityService.findMany('api::payment.payment', {
                filters: {
                  provider: { $eq: 'tochka' },
                  refundStatus: { $eq: 'pending' },
                },
                populate: ['order'],
                sort: 'updatedAt:asc',
                limit: 100,
              })

              for (const payment of payments) {
                const order = payment.order
                const operationId = payment.sessionId || payment.refundId || payment.paymentId
                if (!operationId) continue

                try {
                  const refundStatus = await tochkaPayService.getRefundStatus(operationId)
                  const rawStatus = refundStatus?.status

                  if (isRefundSucceeded(rawStatus)) {
                    await strapi.entityService.update('api::payment.payment', payment.id, {
                      data: {
                        status: 'refunded',
                        refundStatus: 'succeeded',
                        refundedAt: new Date().toISOString(),
                        refundData: refundStatus.raw,
                      },
                    })

                    if (order && order.status !== 'cancelled') {
                      await strapi.entityService.update('api::order.order', order.id, {
                        data: {
                          status: 'cancelled',
                          cancelledAt: new Date().toISOString(),
                          cancelReason: order.cancelReason || 'Отменено: возврат средств подтверждён',
                        },
                      })
                    }
                  } else if (isRefundFailed(rawStatus)) {
                    await strapi.entityService.update('api::payment.payment', payment.id, {
                      data: {
                        refundStatus: 'failed',
                        refundData: refundStatus.raw,
                      },
                    })
                  } else {
                    // keep pending, but store latest raw to help diagnostics
                    await strapi.entityService.update('api::payment.payment', payment.id, {
                      data: {
                        refundData: refundStatus.raw,
                      },
                    })
                  }
                } catch (e) {
                  strapi.log.warn('tochkaRefundSync: failed to sync refund', {
                    paymentId: payment.id,
                    operationId,
                    error: e?.message || String(e),
                  })
                }
              }
            } catch (e) {
              strapi.log.error('tochkaRefundSync task failed', e)
            }
          },
          options: {
            // Every 2 minutes
            rule: '*/2 * * * *',
          },
        },
      },
    },
  };
};