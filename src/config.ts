// Central place for security-sensitive config so the JWT secret and its
// production guard are defined once instead of copy-pasted across routes.

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-dev';
