import { pool } from '../src/db.js';
import { applyMigrations } from '../src/dbInit.js';

try {
  await applyMigrations();
} finally {
  await pool.end();
}
