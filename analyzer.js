// Import the built-in crypto module
const crypto = require('crypto');

/**
 * Analyzes a string and returns all its computed properties.
 * @param {string} value - The input string to analyze.
 * @returns {object} An object containing all the computed properties.
 */
function analyzeString(value) {
  // --- 1. sha256_hash ---
  // This must be first, as it's used as the ID.
  const sha256_hash = crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');

  // --- 2. length ---
  const length = value.length;

  // --- 3. is_palindrome ---
  // Clean the string: lowercase and remove non-alphanumeric chars
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  const reversed = cleaned.split('').reverse().join('');
  const is_palindrome = cleaned === reversed;

  // --- 4. unique_characters ---
  // A Set automatically stores only unique values.
  const uniqueSet = new Set(value);
  const unique_characters = uniqueSet.size;

  // --- 5. word_count ---
  // .trim() removes leading/trailing spaces
  // .split(/\s+/) splits by one or more whitespace characters
  const words = value.trim().split(/\s+/);
  // Handle empty string case
  const word_count = value.trim() === '' ? 0 : words.length;

  // --- 6. character_frequency_map ---
  const character_frequency_map = {};
  for (const char of value) {
    character_frequency_map[char] =
      (character_frequency_map[char] || 0) + 1;
  }

  // --- Return the final object ---
  return {
    length,
    is_palindrome,
    unique_characters,
    word_count,
    sha256_hash, // This is the hash of the *original* string
    character_frequency_map,
  };
}

// We export the function so index.js can use it
module.exports = { analyzeString };