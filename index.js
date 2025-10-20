// 1. Import Express
const express = require('express');
const { analyzeString } = require('./analyzer.js');
const db = require('./db.js');
require('dotenv').config();
// ... after your require('./db.js') line ...

/**
 * Translates a natural language query into a filter object.
 * @param {string} query - The natural language query string.
 * @returns {object} A filter object { word_count, is_palindrome, etc. }
 */
function parseNaturalLanguageQuery(query) {
  const filters = {};
  const lowerQuery = query.toLowerCase();

  // 1. Check for palindrome
  if (lowerQuery.includes('palindrome') || lowerQuery.includes('palindromic')) {
    filters.is_palindrome = 'true';
  }

  // 2. Check for word count
  if (lowerQuery.includes('single word') || lowerQuery.includes('one word')) {
    filters.word_count = '1';
  }

  // 3. Check for length (e.g., "longer than 10")
  const lengthMatch = lowerQuery.match(/longer than (\d+)/);
  if (lengthMatch && lengthMatch[1]) {
    // "longer than 10" means min_length = 11
    filters.min_length = (parseInt(lengthMatch[1]) + 1).toString();
  }

  // 4. Check for contains_character (e.g., "containing the letter z")
  const containsMatch = lowerQuery.match(/containing the letter (\w)/);
  if (containsMatch && containsMatch[1]) {
    filters.contains_character = containsMatch[1];
  }

  // (Heuristic) "first vowel"
  if (lowerQuery.includes('first vowel')) {
    filters.contains_character = 'a';
  }

  return filters;
}

// 2. Create an Express application
const app = express();
// This middleware tells Express to parse incoming JSON bodies
app.use(express.json());

// 3. Define the port
// We use a variable for the port, so we can change it later (e.g., for hosting)
const PORT = 3000;

// 4. Create a simple "health check" route
// This tells us the server is running
app.get('/', (req, res) => {
  res.status(200).send('String Analyzer API is running!');
  //const testString = 'A man, a plan, a canal: Panama';
  //const properties = analyzeString(testString);
  // Send the properties as a JSON response
  //res.json(properties);
});

// 5. Create/Analyze String Endpoint
app.post('/strings', (req, res) => {
  // (a) --- Validation ---
  const { value } = req.body;

  if (!value) {
    return res.status(400).json({ error: 'Missing "value" field' });
  }

  if (typeof value !== 'string') {
    return res
      .status(422)
      .json({ error: 'Invalid data type for "value" (must be string)' });
  }

  // (b) --- Check for Conflict ---
  // We query the DB to see if this string *value* already exists
  const checkQuery = `SELECT * FROM strings WHERE value = ?`;

  db.get(checkQuery, [value], (err, row) => {
    if (err) {
      return res
        .status(500)
        .json({ error: 'Database error', details: err.message });
    }

    // If 'row' is not empty, it means we found a match.
    if (row) {
      return res.status(409).json({ error: 'String already exists' });
    }

    // (c) --- Analyze and Insert ---
    // If we're here, the string is new. Let's analyze it.
    const properties = analyzeString(value);
    const createdAt = new Date().toISOString();

    // We MUST convert the map object to a JSON string to store it in a TEXT column
    const freqMapString = JSON.stringify(properties.character_frequency_map);

    const insertQuery = `
      INSERT INTO strings 
        (value, sha256_hash, length, is_palindrome, unique_characters, word_count, character_frequency_map, created_at)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      value,
      properties.sha256_hash,
      properties.length,
      properties.is_palindrome,
      properties.unique_characters,
      properties.word_count,
      freqMapString, // Save the stringified version
      createdAt,
    ];

    db.run(insertQuery, params, function (err) {
      if (err) {
        return res
          .status(500)
          .json({ error: 'Database error on insert', details: err.message });
      }

      // (d) --- Format and Respond ---
      // Build the final response object as specified in the task
      const response = {
        id: properties.sha256_hash, // The task asks for the hash as the ID
        value: value,
        properties: properties, // The full properties object
        created_at: createdAt,
      };

      res.status(201).json(response); // 201 Created
    });
  });
});

// 6. Get Specific String Endpoint
app.get('/strings/:value', (req, res) => {
  // (a) --- Get value from URL parameter ---
  const { value } = req.params;

  // (b) --- Query the database ---
  const query = `SELECT * FROM strings WHERE value = ?`;

  db.get(query, [value], (err, row) => {
    if (err) {
      return res
        .status(500)
        .json({ error: 'Database error', details: err.message });
    }

    // (c) --- Handle Not Found ---
    // If 'row' is empty/null, the string doesn't exist.
    if (!row) {
      return res.status(404).json({ error: 'String does not exist' });
    }

    // (d) --- Handle Found: Format and Respond ---
    
    // We must parse the frequency map string back into an object
    const properties = {
      length: row.length,
      is_palindrome: !!row.is_palindrome, // Converts 1/0 from DB to true/false
      unique_characters: row.unique_characters,
      word_count: row.word_count,
      sha256_hash: row.sha256_hash,
      character_frequency_map: JSON.parse(row.character_frequency_map),
    };
    
    // Build the final response object
    const response = {
      id: row.sha256_hash,
      value: row.value,
      properties: properties,
      created_at: row.created_at,
    };

    res.status(200).json(response);
  });
});
// 7. Delete String Endpoint
app.delete('/strings/:value', (req, res) => {
  // (a) --- Get value from URL parameter ---
  const { value } = req.params;

  // (b) --- Run the delete query ---
  const query = `DELETE FROM strings WHERE value = ?`;

  // Use db.run for actions that don't return rows (INSERT, UPDATE, DELETE)
  // We use `function(err)` here specifically so we can access `this.changes`
  db.run(query, [value], function (err) {
    if (err) {
      return res
        .status(500)
        .json({ error: 'Database error', details: err.message });
    }

    // (c) --- Handle Not Found ---
    // `this.changes` tells us how many rows were affected by the query.
    // If 0 rows were changed, it means that value didn't exist.
    if (this.changes === 0) {
      return res.status(404).json({ error: 'String does not exist' });
    }

    // (d) --- Handle Successful Deletion ---
    // Send a 204 status with no response body
    res.status(204).send();
  });
});
// 8. Get All Strings with Filtering
app.get('/strings', (req, res) => {
  // (a) --- Base Query and Filter Setup ---
  let query = `SELECT * FROM strings`;
  const whereClauses = [];
  const params = [];

  // (b) --- Check each possible filter ---
  const {
    is_palindrome,
    min_length,
    max_length,
    word_count,
    contains_character,
  } = req.query;

  if (is_palindrome !== undefined) {
    if (is_palindrome !== 'true' && is_palindrome !== 'false') {
      return res.status(400).json({
        error: "Invalid value for 'is_palindrome', must be 'true' or 'false'",
      });
    }
    whereClauses.push(`is_palindrome = ?`);
    params.push(is_palindrome === 'true' ? 1 : 0); // SQLite uses 1 for true, 0 for false
  }

  if (min_length !== undefined) {
    const min = parseInt(min_length);
    if (isNaN(min)) {
      return res
        .status(400)
        .json({ error: "Invalid value for 'min_length', must be an integer" });
    }
    whereClauses.push(`length >= ?`);
    params.push(min);
  }

  if (max_length !== undefined) {
    const max = parseInt(max_length);
    if (isNaN(max)) {
      return res
        .status(400)
        .json({ error: "Invalid value for 'max_length', must be an integer" });
    }
    whereClauses.push(`length <= ?`);
    params.push(max);
  }

  if (word_count !== undefined) {
    const count = parseInt(word_count);
    if (isNaN(count)) {
      return res
        .status(400)
        .json({ error: "Invalid value for 'word_count', must be an integer" });
    }
    whereClauses.push(`word_count = ?`);
    params.push(count);
  }

  if (contains_character !== undefined) {
    if (typeof contains_character !== 'string') {
      return res.status(400).json({
        error: "Invalid value for 'contains_character', must be a string",
      });
    }
    whereClauses.push(`value LIKE ?`);
    params.push(`%${contains_character}%`); // LIKE '%' checks for the character anywhere
  }

  // (c) --- Build the Final Query ---
  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // (d) --- Run the query ---
  // Use db.all() to get all matching rows
  db.all(query, params, (err, rows) => {
    if (err) {
      return res
        .status(500)
        .json({ error: 'Database error', details: err.message });
    }
    
    // (e) --- Format and Respond ---
    
    // We need to parse the map for *every* row
    const formattedData = rows.map((row) => {
      const properties = {
        length: row.length,
        is_palindrome: !!row.is_palindrome,
        unique_characters: row.unique_characters,
        word_count: row.word_count,
        sha256_hash: row.sha256_hash,
        character_frequency_map: JSON.parse(row.character_frequency_map),
      };

      return {
        id: row.sha256_hash,
        value: row.value,
        properties: properties,
        created_at: row.created_at,
      };
    });

    // Build the final response object
    const response = {
      data: formattedData,
      count: formattedData.length,
      filters_applied: req.query, // Just send back the query object
    };

    res.status(200).json(response);
  });
});
// 9. Natural Language Filtering Endpoint
app.get('/strings/filter-by-natural-language', (req, res) => {
  const { query: naturalQuery } = req.query;

  if (!naturalQuery) {
    return res
      .status(400)
      .json({ error: 'Missing "query" query parameter' });
  }

  // (a) --- Parse the natural language string ---
  const parsed_filters = parseNaturalLanguageQuery(naturalQuery);

  // If the parser returns no filters, it couldn't understand the query.
  if (Object.keys(parsed_filters).length === 0) {
    return res
      .status(400)
      .json({ error: 'Unable to parse natural language query' });
  }

  // (b) --- Build the query from the parsed filters ---
  // (This is the same logic as your GET /strings endpoint)
  let query = `SELECT * FROM strings`;
  const whereClauses = [];
  const params = [];

  const {
    is_palindrome,
    min_length,
    max_length,
    word_count,
    contains_character,
  } = parsed_filters;

  if (is_palindrome !== undefined) {
    whereClauses.push(`is_palindrome = ?`);
    params.push(is_palindrome === 'true' ? 1 : 0);
  }
  if (min_length !== undefined) {
    whereClauses.push(`length >= ?`);
    params.push(parseInt(min_length));
  }
  if (max_length !== undefined) {
    whereClauses.push(`length <= ?`);
    params.push(parseInt(max_length));
  }
  if (word_count !== undefined) {
    whereClauses.push(`word_count = ?`);
    params.push(parseInt(word_count));
  }
  if (contains_character !== undefined) {
    whereClauses.push(`value LIKE ?`);
    params.push(`%${contains_character}%`);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  // (c) --- Run the query and format response ---
  db.all(query, params, (err, rows) => {
    if (err) {
      return res
        .status(500)
        .json({ error: 'Database error', details: err.message });
    }

    const formattedData = rows.map((row) => {
      const properties = {
        length: row.length,
        is_palindrome: !!row.is_palindrome,
        unique_characters: row.unique_characters,
        word_count: row.word_count,
        sha256_hash: row.sha256_hash,
        character_frequency_map: JSON.parse(row.character_frequency_map),
      };
      return {
        id: row.sha256_hash,
        value: row.value,
        properties: properties,
        created_at: row.created_at,
      };
    });

    // Build the final, special response object
    const response = {
      data: formattedData,
      count: formattedData.length,
      interpreted_query: {
        original: naturalQuery,
        parsed_filters: parsed_filters,
      },
    };

    res.status(200).json(response);
  });
});

// ... your app.listen() should be at the very end ...
// 10. Start the server
app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});