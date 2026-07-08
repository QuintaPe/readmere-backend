import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { getUserAccess } from '../lib/user-access';

// Passport ya aumenta Express.Request con `user?: Express.User`; declaramos
// aquí la forma real del payload para que passport y este middleware coincidan
// (si no, los tipos de los handlers chocan con los de @types/passport).
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
      status?: string;
    }
  }
}

export interface AuthRequest extends Request {
  user?: Express.User;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: { id: string; email: string; role: string };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // El token firma quién eres; el estado vigente (suspendido, rol) sale de
    // la BD para que los cambios de admin apliquen sin esperar a que caduque.
    const access = await getUserAccess(decoded.id);
    if (!access || !access.active) {
      return res.status(401).json({ error: 'Cuenta suspendida o eliminada' });
    }
    req.user = { id: decoded.id, email: access.email, role: access.role };
    next();
  } catch (err) {
    next(err);
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  });
};
