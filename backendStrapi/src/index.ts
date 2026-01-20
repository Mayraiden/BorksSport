import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Проверяем, что email плагин отключен
    if (strapi.plugins['email']) {
      strapi.log.warn('⚠️  ВНИМАНИЕ: Email плагин загружен, хотя должен быть отключен!');
      strapi.log.warn('   Проверьте config/plugins.ts - email плагин должен быть отключен (enabled: false)');
    } else {
      strapi.log.info('✅ Email плагин отключен');
    }
  },
};
