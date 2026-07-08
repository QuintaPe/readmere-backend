import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

// Un solo sitio firma JWTs de sesión: mismo payload y expiración en signup,
// login, refresh, Google OAuth e impersonación (que acorta la vida a 2h).
export function signUserToken(
  user: { id: string; email: string; role: string },
  expiresIn: '7d' | '2h' = '7d',
): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn },
  );
}
