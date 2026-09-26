import pg from 'pg';
import { readFile } from 'node:fs/promises';
import argon2 from 'argon2';
import { config } from './config.js';
import { pool, transaction } from './db.js';

const { Client } = pg;

const logInfo = (logger, msg) => {
  if (typeof logger?.info === 'function') {
    logger.info(msg);
  } else {
    console.log(msg);
  }
};

const logWarn = (logger, msg) => {
  if (typeof logger?.warn === 'function') {
    logger.warn(msg);
  } else {
    console.warn(msg);
  }
};

const logError = (logger, err, msg) => {
  if (typeof logger?.error === 'function') {
    logger.error({ err }, msg);
  } else {
    console.error(msg, err);
  }
};

/**
 * Ejecuta el archivo schema.sql sobre la base de datos conectada en el pool.
 */
export async function applyMigrations(logger) {
  const schemaUrl = new URL('../database/schema.sql', import.meta.url);
  const sql = await readFile(schemaUrl, 'utf8');
  await pool.query(sql);
  logInfo(logger, 'Esquema de PostgreSQL verificado y actualizado.');
}

/**
 * Inserta las credenciales iniciales de administrador y datos demo de prueba.
 */
export async function seedDatabase(logger) {
  const passwordHash = await argon2.hash('Cedemco2026!', {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 3,
    parallelism: 1,
  });

  await transaction(async (client) => {
    const { rows: [admin] } = await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Administrador CEDEMCO', 'admin@cedemco.local', $1, 'admin')
      ON CONFLICT DO NOTHING RETURNING id`, [passwordHash]);
    let adminId = admin?.id;
    if (!adminId) {
      ({ rows: [{ id: adminId }] } = await client.query("SELECT id FROM users WHERE lower(email)='admin@cedemco.local'"));
    }

    const { rows: [standard] } = await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ('Ana Martínez', 'ana@cedemco.local', $1, 'standard')
      ON CONFLICT DO NOTHING RETURNING id`, [passwordHash]);
    let userId = standard?.id;
    if (!userId) {
      ({ rows: [{ id: userId }] } = await client.query("SELECT id FROM users WHERE lower(email)='ana@cedemco.local'"));
    }

    const exists = await client.query('SELECT id FROM projects LIMIT 1');
    if (exists.rowCount) return;

    const { rows: [entrepreneur] } = await client.query(`INSERT INTO entrepreneurs
      (owner_user_id, full_name, email, phone, municipality, education, notes)
      VALUES ($1,'Mariana Pech','mariana@example.com','999 123 4567','Mérida','Licenciatura','Emprendedora de alimentos sostenibles') RETURNING id`, [userId]);

    const { rows: [project] } = await client.query(`INSERT INTO projects
      (owner_user_id, entrepreneur_id, name, description, sector, stage, progress, start_date, end_date)
      VALUES ($1,$2,'Maya Verde','Snacks regionales con ingredientes de origen responsable','Alimentos','Validación',64,CURRENT_DATE - 45,CURRENT_DATE + 75) RETURNING id`, [userId, entrepreneur.id]);

    await client.query(`INSERT INTO objectives (project_id,title,specific,measurable,achievable,relevant,due_date,progress)
      VALUES ($1,'Validar propuesta de valor','Validar tres presentaciones con clientes','Lograr 50 entrevistas y 20 preventas','Se cuenta con prototipos y mercado piloto','Confirma el encaje producto-mercado',CURRENT_DATE + 30,60)`, [project.id]);

    await client.query(`INSERT INTO tasks (project_id,title,status,priority,start_date,due_date,position) VALUES
      ($1,'Definir guion de entrevistas','completed',2,CURRENT_DATE-20,CURRENT_DATE-17,0),
      ($1,'Realizar entrevistas con clientes','in_progress',1,CURRENT_DATE-16,CURRENT_DATE+7,0),
      ($1,'Revisar etiquetado nutrimental','review',1,CURRENT_DATE-5,CURRENT_DATE+5,0),
      ($1,'Preparar prueba de mercado','pending',2,CURRENT_DATE+6,CURRENT_DATE+18,0)`, [project.id]);

    await client.query(`INSERT INTO meetings (project_id,created_by,title,scheduled_at,duration_minutes,location,attendees)
      VALUES ($1,$2,'Revisión mensual',date_trunc('day',now()) + interval '3 day 16 hour',60,'Sala CEDEMCO','Mariana Pech, Ana Martínez')`, [project.id, userId]);
  });

  logInfo(logger, 'Datos de prueba iniciales creados. Usuario: admin@cedemco.local / Cedemco2026!');
}

/**
 * Verifica si la base de datos existe; si no existe, la crea conectándose a la BD de mantenimiento.
 * Luego asegura que las tablas y datos iniciales existan.
 */
export async function ensureDatabase(logger) {
  if (!config.databaseUrl) {
    logWarn(logger, 'DATABASE_URL no configurada; omitiendo verificación de base de datos.');
    return;
  }

  let targetDbName = '';
  try {
    const parsedUrl = new URL(config.databaseUrl);
    targetDbName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
  } catch {
    // Si DATABASE_URL no es una URL parseable estándar
    return;
  }

  if (!targetDbName) return;

  // 1. Probar si la base de datos ya existe conectándonos a ella
  let dbExists = false;
  const probeClient = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 5000,
  });

  try {
    await probeClient.connect();
    dbExists = true;
  } catch (err) {
    // Código '3D000': database does not exist (INVALID_CATALOG_NAME)
    if (err.code === '3D000') {
      dbExists = false;
    } else {
      // Otro tipo de error (e.g. ECONNREFUSED o contraseña incorrecta)
      throw err;
    }
  } finally {
    await probeClient.end().catch(() => {});
  }

  // 2. Si no existe, conectarse a la base administrativa '/postgres' y crearla
  if (!dbExists) {
    if (!/^[a-zA-Z0-9_-]+$/.test(targetDbName)) {
      throw new Error(`El nombre de base de datos "${targetDbName}" contiene caracteres no válidos.`);
    }

    const adminUrl = new URL(config.databaseUrl);
    adminUrl.pathname = '/postgres';

    const adminClient = new Client({
      connectionString: adminUrl.href,
      ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
      connectionTimeoutMillis: 5000,
    });

    try {
      await adminClient.connect();
      logInfo(logger, `Base de datos "${targetDbName}" no encontrada. Creándola automáticamente...`);
      await adminClient.query(`CREATE DATABASE "${targetDbName.replace(/"/g, '""')}"`);
      logInfo(logger, `Base de datos "${targetDbName}" creada exitosamente.`);
    } catch (adminErr) {
      // 42P04: duplicate_database (si otro proceso la creó al mismo tiempo)
      if (adminErr.code === '42P04') {
        logInfo(logger, `Base de datos "${targetDbName}" ya existente.`);
      } else {
        throw adminErr;
      }
    } finally {
      await adminClient.end().catch(() => {});
    }
  }

  // 3. Aplicar migraciones estructurales (schema.sql)
  await applyMigrations(logger);

  // 4. Verificar si la tabla de usuarios está vacía para cargar datos iniciales
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users WHERE deleted_at IS NULL');
    if (rows[0]?.count === 0) {
      logInfo(logger, 'Base de datos recién creada o sin usuarios. Creando credenciales iniciales...');
      await seedDatabase(logger);
    }
  } catch (err) {
    logError(logger, err, 'Error al verificar o inicializar datos iniciales');
  }
}
