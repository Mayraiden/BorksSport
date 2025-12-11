#!/usr/bin/env node

/**
 * Скрипт для исправления экспорта конфигурационных файлов после сборки
 * Обеспечивает совместимость с Strapi 5 production режимом
 */

const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '..', 'dist', 'config');

if (!fs.existsSync(configDir)) {
  console.error('Config directory not found:', configDir);
  process.exit(1);
}

const configFiles = ['database.js', 'admin.js', 'server.js', 'middlewares.js', 'plugins.js', 'api.js'];

configFiles.forEach((file) => {
  const filePath = path.join(configDir, file);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Проверяем, не добавлен ли уже module.exports
    if (!content.includes('module.exports =')) {
      // Добавляем module.exports для совместимости
      content += '\n\n// Для совместимости с Strapi 5 production\n';
      content += 'if (typeof module !== "undefined" && module.exports && !module.exports.default) {\n';
      content += '  module.exports = exports.default || exports;\n';
      content += '}\n';
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed exports in ${file}`);
    } else {
      console.log(`Skipped ${file} (already has module.exports)`);
    }
  } else {
    console.warn(`Config file not found: ${file}`);
  }
});

console.log('Config exports fix completed');

