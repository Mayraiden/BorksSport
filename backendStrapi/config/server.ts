export default ({ env }) => {
  const isDevelopment = env('NODE_ENV', 'development') === 'development';

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    proxy: !isDevelopment,
    url: env(
      'PUBLIC_URL',
      isDevelopment ? 'http://localhost:1337' : 'https://api.borkssport.ru'
    ),
    app: {
      keys: env.array('APP_KEYS'),
    },
    allowedHosts: isDevelopment
      ? ['localhost', '127.0.0.1']
      : ['api.borkssport.ru', 'borkssport.ru', 'www.borkssport.ru'],
  };
};
