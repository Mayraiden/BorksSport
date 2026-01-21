export default ({ env }) => {
  const isDevelopment = env('NODE_ENV', 'production') === 'development';

  return {
    auth: {
      secret: env('ADMIN_JWT_SECRET'),
      sessions: {
        cookie: {
          secure: !isDevelopment, 
          httpOnly: true,
          sameSite: 'lax',
        },
      },
    },
    apiToken: {
      salt: env('API_TOKEN_SALT'),
    },
    transfer: {
      token: {
        salt: env('TRANSFER_TOKEN_SALT'),
      },
    },
    secrets: {
      encryptionKey: env('ENCRYPTION_KEY'),
    },
    path: '/admin',
    serveAdminPanel: true,
  };
};