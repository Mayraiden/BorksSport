import type { Core } from '@strapi/strapi';

type GenericObject = Record<string, any>;

const isEmailAuthDisabled = () => {
  const raw = process.env.EMAIL_AUTH_DISABLED;
  return raw === '1' || raw === 'true' || raw === 'yes';
};

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
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    if (!strapi.plugins['email']) {
      strapi.log.warn('Email plugin is not loaded. Email confirmation will not work.');
      return;
    }

    if (isEmailAuthDisabled()) {
      strapi.log.warn('EMAIL_AUTH_DISABLED is enabled. Email confirmation is turned off.');
    }

    const frontendUrlRaw =
      process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const frontendUrl = frontendUrlRaw.replace(/\/+$/, '');

    // Synchronize users-permissions advanced auth settings across environments.
    const advancedStore = strapi.store({
      type: 'plugin',
      name: 'users-permissions',
      key: 'advanced',
    });

    const currentAdvanced = ((await advancedStore.get()) || {}) as GenericObject;
    await advancedStore.set({
      value: {
        ...currentAdvanced,
        allow_register: true,
        email_confirmation: !isEmailAuthDisabled(),
        email_confirmation_redirection: `${frontendUrl}/auth/confirm-email?status=success`,
      },
    });

    const emailStore = strapi.store({
      type: 'plugin',
      name: 'users-permissions',
      key: 'email',
    });

    const currentEmailConfig = ((await emailStore.get()) || {}) as GenericObject;
    const currentEmailConfirmation = (currentEmailConfig.email_confirmation || {}) as GenericObject;
    const currentConfirmationOptions = (currentEmailConfirmation.options || {}) as GenericObject;

    await emailStore.set({
      value: {
        ...currentEmailConfig,
        email_confirmation: {
          ...currentEmailConfirmation,
          options: {
            ...currentConfirmationOptions,
            from: currentConfirmationOptions.from || {
              name: 'BorksSport',
              email: process.env.MAILGUN_DEFAULT_FROM || 'no-reply@borkssport.ru',
            },
            response_email:
              currentConfirmationOptions.response_email ||
              process.env.MAILGUN_DEFAULT_REPLY_TO ||
              'support@borkssport.ru',
            object:
              currentConfirmationOptions.object ||
              'Подтверждение email для аккаунта BorksSport',
            message:
              currentConfirmationOptions.message ||
              `Здравствуйте, <%= USER.username %>!\n\nПодтвердите email по ссылке:\n<%= URL %>?confirmation=<%= CODE %>\n\nЕсли вы не создавали аккаунт, просто проигнорируйте это письмо.`,
          },
        },
      },
    });

    strapi.log.info('Email plugin is enabled. Email confirmation is configured.');
  },
};
