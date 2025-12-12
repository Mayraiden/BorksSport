export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  proxy: true,
  url: env('PUBLIC_URL', 'https://api.borkssport.ru'),
  allowedHosts: [
    'localhost',
    'api.borkssport.ru',
    '185.251.88.214',
    'borkssport.ru',
    'www.borkssport.ru',
  ],
});
