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
  const passwordsFilePath = path.join(__dirname, 'password.txt');

  if (!fs.existsSync(usersFilePath)) {
    console.error(`Error: "${usersFilePath}" not found. Please create it first.`);
    process.exit(1);
  }

  let targetPasswordPath = passwordsFilePath;
  if (!fs.existsSync(targetPasswordPath)) {
    const alternativePath = path.join(__dirname, 'passwords.txt');
    if (fs.existsSync(alternativePath)) {
      targetPasswordPath = alternativePath;
    } else {
      console.error(`Error: "${passwordsFilePath}" not found. Please create it first.`);
      process.exit(1);
    }
  }

  // Read usernames and filter empty lines
  const usernames = fs.readFileSync(usersFilePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // Read passwords and filter empty lines
  const passwords = fs.readFileSync(targetPasswordPath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (usernames.length === 0) {
    console.log('No usernames found in users.txt.');
    process.exit(0);
  }

  if (passwords.length === 0) {
    console.log(`No passwords found in ${path.basename(targetPasswordPath)}.`);
    process.exit(0);
  }

  if (usernames.length !== passwords.length) {
    console.error(
      `Error: Count mismatch! Found ${usernames.length} usernames in users.txt and ${passwords.length} passwords in ${path.basename(targetPasswordPath)}.`
    );
    process.exit(1);
  }

  console.log(`Starting bulk import of ${usernames.length} users with individual passwords...`);

  try {
    await db.query('BEGIN');

    console.log('Cleaning up existing participant users...');
    const deleteRes = await db.query("DELETE FROM users WHERE role = 'participant'");
    console.log(`- Cleared ${deleteRes.rowCount || 0} old participant user(s) (admin users preserved).`);

    let importedCount = 0;
    const passwordHashCache = new Map();

    for (let i = 0; i < usernames.length; i++) {
      const username = usernames[i];
      const password = passwords[i];

      // Get cached hash or hash new password
      let passwordHash = passwordHashCache.get(password);
      if (!passwordHash) {
        passwordHash = await bcrypt.hash(password, 10);
        passwordHashCache.set(password, passwordHash);
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
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Failed to complete bulk import transaction:', error);
  } finally {
    process.exit(0);
  }
}

bulkImport();
