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
          // Проверяем, что email провайдер настроен корректно перед отправкой
          const emailService = strapi.plugins['email']?.services?.email;
          if (emailService) {
            await strapi.plugins['users-permissions'].services.user.sendConfirmationEmail(user);
          } else {
            strapi.log.warn('Email service is not configured. Skipping confirmation email.');
          }
        } catch (err: any) {
          // Логируем ошибку, но не прерываем процесс регистрации
          strapi.log.error('Error sending confirmation email:', err);
          // Если это ошибка подключения к SMTP, логируем предупреждение
          if (err?.message?.includes('ECONNREFUSED') || err?.message?.includes('timeout') || err?.message?.includes('Authentication failed')) {
            strapi.log.warn('SMTP connection error detected. Please check email configuration in admin panel.');
          }
        }
      }

      // Генерируем access token (короткий срок жизни - 15 минут)
      const accessToken = strapi.plugins['users-permissions'].services.jwt.issue({
        id: user.id,
      })

      // Генерируем refresh token
      const refreshTokenService = strapi.service('api::refresh-token.refresh-token')
      const refreshToken = await refreshTokenService.generateRefreshToken(user.id)

      // Устанавливаем refresh token в HTTP-only cookie
      const isDevelopment = process.env.NODE_ENV === 'development'
      ctx.cookies.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure: !isDevelopment, // true в production (HTTPS), false в development
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
        path: '/',
      })

      ctx.send({
        jwt: accessToken,
        refreshToken: refreshToken, // Также возвращаем в ответе для совместимости (но лучше использовать cookie)
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: (user as { firstName?: string }).firstName,
          phone: (user as { phone?: string }).phone,
        },
      });
    };

    // Расширяем login контроллер (callback) для генерации refresh token
    const originalCallback = strapi.plugins['users-permissions'].controllers.auth.callback.bind(
      strapi.plugins['users-permissions'].controllers.auth
    );

    strapi.plugins['users-permissions'].controllers.auth.callback = async (ctx: any) => {
      // Вызываем оригинальный callback
      await originalCallback(ctx);

      // Если логин успешен (есть jwt и user в ответе), генерируем refresh token
      if (ctx.body?.jwt && ctx.body?.user?.id) {
        try {
          const refreshTokenService = strapi.service('api::refresh-token.refresh-token');
          const refreshToken = await refreshTokenService.generateRefreshToken(ctx.body.user.id);

          // Устанавливаем refresh token в HTTP-only cookie
          const isDevelopment = process.env.NODE_ENV === 'development';
          ctx.cookies.set('refreshToken', refreshToken, {
            httpOnly: true,
            secure: !isDevelopment,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
            path: '/',
          });

          // Также возвращаем в ответе для совместимости
          ctx.body.refreshToken = refreshToken;
        } catch (error) {
          strapi.log.error('Error generating refresh token:', error);
          // Не прерываем процесс логина, если refresh token не удалось создать
        }
      }
    };
  },
};
