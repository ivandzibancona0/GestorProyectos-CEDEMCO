import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { config, isProduction } from './config.js';
import { router } from './routes.js';
import { pool } from './db.js';
import { ensureDatabase } from './dbInit.js';

const app = express();
const logger = pino({ level: config.logLevel, redact: ['req.headers.cookie', 'req.headers.authorization', 'password', 'resetToken'] });
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(pinoHttp({ logger }));
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc:["'self'"], scriptSrc:["'self'"], styleSrc:["'self'",'https://fonts.googleapis.com'], imgSrc:["'self'",'data:'], fontSrc:["'self'",'https://fonts.gstatic.com'], connectSrc:["'self'"], objectSrc:["'none'"], frameAncestors:["'none'"], baseUri:["'self'"], formAction:["'self'"] } },
  strictTransportSecurity: isProduction ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));
app.use(express.json({ limit: '256kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(cookieParser());
app.use('/api', router);
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url)), {
  index: 'index.html',
  maxAge: isProduction ? '5m' : 0,
  etag: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));
app.get('/health', async (_req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok'})}catch{res.status(503).json({status:'unavailable'})}});
app.use('/api', (_req,res)=>res.status(404).json({error:'Ruta no encontrada.'}));
app.use((error, req, res, _next)=>{
  req.log.error({err:error},'Error no controlado');
  if (error?.code==='23505') return res.status(409).json({error:'Ya existe un registro con esos datos.'});
  if (error?.code==='22P02') return res.status(400).json({error:'Identificador no válido.'});
  res.status(500).json({error:'Ocurrió un error inesperado. Intente nuevamente.'});
});

if (config.autoInitDb) {
  try {
    await ensureDatabase(logger);
  } catch (error) {
    logger.error({ err: error }, 'Error al inicializar la base de datos automáticamente');
  }
}

const server=app.listen(config.port,()=>logger.info(`CEDEMCO disponible en ${config.appOrigin}`));
const shutdown=async()=>{server.close(async()=>{await pool.end();process.exit(0)})};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);

export { app };
