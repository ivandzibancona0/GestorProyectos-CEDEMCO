import { pool } from '../src/db.js';
import { seedDatabase } from '../src/dbInit.js';

try {
  await seedDatabase();
} finally {
  await pool.end();
}
