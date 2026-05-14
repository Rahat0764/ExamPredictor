const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing');
const sql = neon(process.env.DATABASE_URL);

let initialized = false;

async function initDB() {
  if (initialized) return;

  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      avatar_url TEXT,
      provider TEXT DEFAULT 'email',
      provider_id TEXT,
      password_hash TEXT,
      email_verified BOOLEAN DEFAULT FALSE,
      verification_token TEXT,
      verification_expires TIMESTAMPTZ,
      reset_token TEXT,
      reset_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      subject_id INTEGER REFERENCES subjects(id),
      year INTEGER NOT NULL,
      text TEXT DEFAULT '',
      image_url TEXT,
      drive_file_id TEXT,
      mime_type TEXT DEFAULT 'image/jpeg',
      ocr_done BOOLEAN DEFAULT FALSE,
      ocr_failed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS resources (
      id SERIAL PRIMARY KEY,
      subject_name TEXT,
      name TEXT,
      text TEXT DEFAULT '',
      file_url TEXT,
      drive_file_id TEXT,
      mime_type TEXT DEFAULT 'application/pdf',
      type TEXT DEFAULT 'image',
      ocr_done BOOLEAN DEFAULT FALSE,
      total_pages INTEGER DEFAULT 0,
      pages_processed INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS prediction_jobs (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      target_year INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      progress_stage TEXT DEFAULT 'queued',
      progress_current INTEGER DEFAULT 0,
      progress_total INTEGER DEFAULT 0,
      progress_message TEXT DEFAULT '',
      result JSONB,
      cancel_reason TEXT,
      ip TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Indexes for performance
  await sql`CREATE INDEX IF NOT EXISTS idx_questions_subject_year ON questions(subject_id, year)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_prediction_jobs_status ON prediction_jobs(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;

  initialized = true;
  console.log('DB initialized');
}

module.exports = { sql, initDB };