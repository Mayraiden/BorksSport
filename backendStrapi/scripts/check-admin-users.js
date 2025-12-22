/**
 * Скрипт для проверки администраторов в базе данных Strapi
 * Использование: node scripts/check-admin-users.js
 */

const { createStrapi, compileStrapi } = require('@strapi/strapi');

async function checkAdminUsers() {
  try {
    console.log('Загрузка Strapi...');
    const appContext = await compileStrapi();
    const app = await createStrapi(appContext).load();

    console.log('\n=== Проверка администраторов ===\n');

    // Получаем всех админов
    const adminUsers = await app.db
      .query('admin::user')
      .findMany({});

    if (adminUsers.length === 0) {
      console.log('❌ Администраторы не найдены в базе данных');
      console.log('   Нужно создать первого администратора при следующем запуске Strapi');
    } else {
      console.log(`✅ Найдено администраторов: ${adminUsers.length}\n`);
      
      adminUsers.forEach((admin, index) => {
        console.log(`Администратор #${index + 1}:`);
        console.log(`  ID: ${admin.id}`);
        console.log(`  Email: ${admin.email}`);
        console.log(`  Имя: ${admin.firstname || 'не указано'}`);
        console.log(`  Фамилия: ${admin.lastname || 'не указано'}`);
        console.log(`  Активен: ${admin.is_active ? '✅ Да' : '❌ Нет'}`);
        console.log(`  Подтвержден: ${admin.confirmed ? '✅ Да' : '❌ Нет'}`);
        console.log(`  Блокирован: ${admin.blocked ? '❌ Да' : '✅ Нет'}`);
        console.log(`  Создан: ${admin.createdAt}`);
        console.log('');
      });
    }

    // Проверяем конкретного пользователя
    const emailToCheck = 'vitas@gmail.com';
    console.log(`\n=== Поиск администратора: ${emailToCheck} ===\n`);
    
    const specificAdmin = await app.db
      .query('admin::user')
      .findOne({ where: { email: emailToCheck } });

    if (specificAdmin) {
      console.log(`✅ Администратор найден:`);
      console.log(`  Email: ${specificAdmin.email}`);
      console.log(`  Активен: ${specificAdmin.is_active ? '✅ Да' : '❌ Нет'}`);
      console.log(`  Подтвержден: ${specificAdmin.confirmed ? '✅ Да' : '❌ Нет'}`);
      console.log(`  Блокирован: ${specificAdmin.blocked ? '❌ Да' : '✅ Нет'}`);
      
      if (!specificAdmin.is_active) {
        console.log('\n⚠️  ВНИМАНИЕ: Администратор неактивен. Это может быть причиной проблем со входом.');
      }
      if (!specificAdmin.confirmed) {
        console.log('\n⚠️  ВНИМАНИЕ: Администратор не подтвержден.');
      }
      if (specificAdmin.blocked) {
        console.log('\n⚠️  ВНИМАНИЕ: Администратор заблокирован.');
      }
    } else {
      console.log(`❌ Администратор с email ${emailToCheck} не найден`);
    }

    await app.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при проверке администраторов:', error);
    process.exit(1);
  }
}

checkAdminUsers();

