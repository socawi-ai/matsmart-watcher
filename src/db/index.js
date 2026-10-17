const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const { config } = require('../config');
const { runMigrations } = require('./migrations');

const dbPath = path.join(config.dataDir, 'app.sqlite');

let dbPromise;

// Opens the database once and brings its schema up to date. Callers share
// the same promise, so nobody gets the connection before setup is finished.
function getDb() {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

async function openAndMigrate() {
  fs.mkdirSync(config.dataDir, { recursive: true });

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON');
  await db.exec('PRAGMA busy_timeout = 5000');
  await runMigrations(db);
  return db;
}

const normalizeUsername = (username) => String(username || '').trim().toLowerCase();

async function findUserByUsername(username) {
  const db = await getDb();
  return db.get('SELECT * FROM users WHERE username = ?', normalizeUsername(username));
}

async function findUserById(id) {
  const db = await getDb();
  return db.get('SELECT * FROM users WHERE id = ?', id);
}

async function countUsers() {
  const db = await getDb();
  const row = await db.get('SELECT COUNT(*) AS count FROM users');
  return Number(row.count);
}

async function createUser({ username, passwordHash }) {
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)',
    normalizeUsername(username),
    passwordHash,
    new Date().toISOString()
  );
  return findUserById(result.lastID);
}

module.exports = { countUsers, createUser, findUserById, findUserByUsername, getDb };
