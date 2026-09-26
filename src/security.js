import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { query } from './db.js';
import { config, isProduction } from './config.js';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('hex');
export const hashPassword = (password) => argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 3,
  parallelism: 1,
});
export const verifyPassword = (hash, password) => argon2.verify(hash, password);

export const sessionCookie = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  path: '/',
  maxAge: config.sessionTtlHours * 60 * 60 * 1000,
};

export async function createSession(userId, req) {
  const token = randomToken();
  const csrf = randomToken();
  await query(`INSERT INTO sessions (user_id, token_hash, csrf_token, user_agent, ip, expires_at)
    VALUES ($1,$2,$3,$4,$5,now() + ($6 || ' hours')::interval)`,
    [userId, sha256(token), csrf, req.get('user-agent')?.slice(0, 500), req.ip, String(config.sessionTtlHours)]);
  return { token, csrf };
}

export async function authenticate(req, res, next) {
  try {
    const token = req.cookies?.cedemco_session;
    if (!token) return res.status(401).json({ error: 'Se requiere iniciar sesión.' });
    const { rows: [session] } = await query(`SELECT s.id AS session_id, s.csrf_token, s.expires_at,
      u.id, u.name, u.email, u.role, u.active
      FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at > now() AND u.deleted_at IS NULL`, [sha256(token)]);
    if (!session || !session.active) {
      res.clearCookie('cedemco_session', sessionCookie);
      return res.status(401).json({ error: 'La sesión no es válida o ha expirado.' });
    }
    req.user = { id: session.id, name: session.name, email: session.email, role: session.role };
    req.session = { id: session.session_id, csrfToken: session.csrf_token };
    next();
  } catch (error) { next(error); }
}

export function requireRole(role) {
  return (req, res, next) => req.user?.role === role ? next() : res.status(403).json({ error: 'No tiene permisos para realizar esta acción.' });
}

export function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.get('x-csrf-token');
  return token && token === req.session?.csrfToken ? next() : res.status(403).json({ error: 'La solicitud no pudo validarse. Actualice la página e intente de nuevo.' });
}

export const publicUser = ({ id, name, email, role, active, last_login_at, created_at }) => ({
  id, name, email, role, active, lastLoginAt: last_login_at, createdAt: created_at,
});
