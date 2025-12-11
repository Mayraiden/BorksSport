/**
 * Скрипт для сброса пароля администратора Strapi
 * Использование: node scripts/reset-admin-password.js <email> <newPassword>
 */

const { createStrapi, compileStrapi } = require('@strapi/strapi');
const crypto = require('crypto');

async function resetAdminPassword(email, newPassword) {
  if (!email || !newPassword) {
    console.error('Использование: node scripts/reset-admin-password.js <email> <newPassword>');
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error('Пароль должен быть не менее 8 символов');
    process.exit(1);
  }

  try {
    console.log('Загрузка Strapi...');
    const appContext = await compileStrapi();
    const app = await createStrapi(appContext).load();

    console.log(`Поиск пользователя с email: ${email}`);
    const adminUser = await app.db
      .query('admin::user')
      .findOne({ where: { email } });

    if (!adminUser) {
      console.error(`Пользователь с email ${email} не найден`);
      await app.destroy();
      process.exit(1);
    }

    console.log(`Найден пользователь: ${adminUser.firstname} ${adminUser.lastname || ''}`);

    // Хешируем новый пароль
    const hashedPassword = await app.admin.services.auth.hashPassword(newPassword);

    // Обновляем пароль
    await app.db
      .query('admin::user')
      .update({
        where: { id: adminUser.id },
        data: { password: hashedPassword },
      });

    console.log('✅ Пароль успешно обновлен!');
    console.log(`Теперь вы можете войти с email: ${email} и новым паролем`);

    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при сбросе пароля:', error);
    process.exit(1);
  }
}

const email = process.argv[2];
const password = process.argv[3];

resetAdminPassword(email, password);


