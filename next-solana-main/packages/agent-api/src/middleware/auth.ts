import { Request, Response, NextFunction } from 'express';

interface AuthUser {
  id: string;
  // Add more user fields as needed
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Implement proper authentication (JWT, API keys, etc.)
  // For now, simulate with a dummy user
  req.user = { id: '1' };
  next();
};
