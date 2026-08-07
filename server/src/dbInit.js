import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import * as db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Run the schema queries
    await db.query(schemaSql);
    await db.query("ALTER TABLE contests ADD COLUMN IF NOT EXISTS elapsed_seconds INTEGER NOT NULL DEFAULT 0;");
    console.log('Database schema initialized successfully.');

    // Seed default admin if none exists
    const adminCheck = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (adminCheck.rows.length === 0) {
      console.log('No admin user found. Creating default admin...');
      const defaultAdminUsername = process.env.ADMIN_USERNAME || 'admin';
      const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const passwordHash = await bcrypt.hash(defaultAdminPassword, 10);
      
      await db.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
        [defaultAdminUsername, passwordHash, 'admin']
      );
      console.log(`Default admin created: Username: "${defaultAdminUsername}", Password: "${defaultAdminPassword}"`);
    }

    // Seed default participant if none exists
    const participantCheck = await db.query("SELECT id FROM users WHERE role = 'participant' LIMIT 1");
    if (participantCheck.rows.length === 0) {
      console.log('No participant user found. Creating default participant USER-101...');
      const defaultParticipantHash = await bcrypt.hash('userpassword', 10);
      const participantRes = await db.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        ['USER-101', defaultParticipantHash, 'participant']
      );
      const participantId = participantRes.rows[0].id;
      await db.query('INSERT INTO participant_status (participant_id) VALUES ($1)', [participantId]);
      console.log('Default participant created: Username: "USER-101", Password: "userpassword"');
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

export default initializeDatabase;
