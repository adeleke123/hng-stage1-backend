// 1. Import Express
const express = require('express');
require('dotenv').config();

// 2. Create an Express application
const app = express();

// 3. Define the port
// We use a variable for the port, so we can change it later (e.g., for hosting)
const PORT = 3000;

// 4. Create a simple "health check" route
// This tells us the server is running
app.get('/', (req, res) => {
  res.send('String Analyzer API is running!');
});

// 5. Start the server
app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});
