const sqlite3 = require('sqlite3').verbose();

// Creates or opens the database file
const db = new sqlite3.Database('./main.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// This SQL command will create the table *only if it doesn't exist*
const createTableQuery = `
CREATE TABLE IF NOT EXISTS strings (
    value TEXT PRIMARY KEY,
    sha256_hash TEXT NOT NULL,
    length INTEGER NOT NULL,
    is_palindrome BOOLEAN NOT NULL,
    unique_characters INTEGER NOT NULL,
    word_count INTEGER NOT NULL,
    character_frequency_map TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);
`;

// Run the query to create the table
db.run(createTableQuery, (err) => {
  if (err) {
    console.error('Error creating table:', err.message);
  } else {
    console.log('Table "strings" created or already exists.');
  }
});

// Export the database connection so our index.js can use it
module.exports = db;