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
    strapi.plugins['users-permissions'].controllers.auth.register = async (ctx: any) => {
      const pluginStore = await strapi.store({ type: 'plugin', name: 'users-permissions' });
      const settings = (await pluginStore.get({ key: 'advanced' })) as {
        default_role?: string;
        email_confirmation?: boolean;
      };

      const body = ctx.request.body || {};
      const { email, username, password, firstName, phone } = body;

      if (!email) {
        return ctx.badRequest('missing.email');
      }

      if (!username) {
        return ctx.badRequest('missing.username');
      }

      if (!password) {
        return ctx.badRequest('missing.password');
      }

      const userWithSameEmail = await strapi
        .query('plugin::users-permissions.user')
        .findOne({ where: { email: email.toLowerCase() } });

      if (userWithSameEmail) {
        return ctx.badRequest('Email already taken');
      }

      const userWithSameUsername = await strapi
        .query('plugin::users-permissions.user')
        .findOne({ where: { username } });

      if (userWithSameUsername) {
        return ctx.badRequest('Username already taken');
      }

      const role = await strapi
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: settings.default_role || 'authenticated' } });

      if (!role) {
        return ctx.badRequest('Impossible to find the default role');
      }

      const userData: Record<string, unknown> = {
        username,
        email: email.toLowerCase(),
        password: await strapi.plugins['users-permissions'].services.user.hashPassword(password),
        role: role.id,
        confirmed: !settings.email_confirmation,
      };

      if (firstName !== undefined && firstName !== null && firstName !== '') {
        userData.firstName = firstName;
      }
      if (phone !== undefined && phone !== null && phone !== '') {
        userData.phone = phone;
      }

      const user = await strapi
        .query('plugin::users-permissions.user')
        .create({ data: userData });

      if (settings.email_confirmation) {
        try {
          await strapi.plugins['users-permissions'].services.user.sendConfirmationEmail(user);
        } catch (err) {
          strapi.log.error('Error sending confirmation email:', err);
        }
      }

      ctx.send({
        jwt: strapi.plugins['users-permissions'].services.jwt.issue({
          id: user.id,
        }),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: (user as { firstName?: string }).firstName,
          phone: (user as { phone?: string }).phone,
        },
      });
    };
  },
};
