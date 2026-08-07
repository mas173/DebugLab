import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_jwt_secret_key_12345';

export function authenticate(req, res, next) {
  // Extract token from Authorization header first, then fallback to Cookie
  let token = null;

  if (req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    authenticate(req, res, () => {
      if (req.user && req.user.role === role) {
        next();
      } else {
        res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
      }
    });
  };
}

export const requireAdmin = requireRole('admin');
export const requireParticipant = requireRole('participant');
