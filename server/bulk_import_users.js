import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import * as db from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bulkImport() {
  const usersFilePath = path.join(__dirname, 'users.txt');
  const defaultPassword = 'user1234';

  if (!fs.existsSync(usersFilePath)) {
    console.error(`Error: "${usersFilePath}" not found. Please create it first.`);
    process.exit(1);
  }

  // Read usernames and filter empty lines
  const usernames = fs.readFileSync(usersFilePath, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (usernames.length === 0) {
    console.log('No usernames found in users.txt.');
    process.exit(0);
  }

  console.log(`Starting bulk import of ${usernames.length} users...`);
  console.log(`Hashing default password "${defaultPassword}" once...`);
  
  // Hash once to save CPU cycles
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  try {
    await db.query('BEGIN');
    let importedCount = 0;
    let skippedCount = 0;

    for (const username of usernames) {
      // Check if user already exists
      const checkRes = await db.query('SELECT id FROM users WHERE username = $1', [username]);
      
      if (checkRes.rows.length > 0) {
        console.log(`- Skipped: User "${username}" already exists.`);
        skippedCount++;
        continue;
      }

      // Insert user
      const userRes = await db.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'participant') RETURNING id",
        [username, passwordHash]
      );
      const userId = userRes.rows[0].id;

      // Insert participant status tracker
      await db.query(
        'INSERT INTO participant_status (participant_id) VALUES ($1)',
        [userId]
      );

      console.log(`+ Imported: User "${username}"`);
      importedCount++;
    }

    await db.query('COMMIT');
    console.log(`\n🎉 Import Complete!`);
    console.log(`- Successfully Imported: ${importedCount} users`);
    console.log(`- Skipped (already existed): ${skippedCount} users`);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Failed to complete bulk import transaction:', error);
  } finally {
    process.exit(0);
  }
}

bulkImport();
