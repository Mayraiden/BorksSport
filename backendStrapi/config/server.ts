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
  };
};