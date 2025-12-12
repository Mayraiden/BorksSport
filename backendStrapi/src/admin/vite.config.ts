import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  return mergeConfig(config, {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: [
        'api.borkssport.ru',
        'localhost',
        '185.251.88.214',
        'borkssport.ru',
        'www.borkssport.ru',
      ],
    },
  });
};

