import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = randomUUID();
  next();
}
