const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware to serve static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Home page route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// API route to get photos data
app.get('/api/photos', (req, res) => {
  fs.readFile(path.join(__dirname, 'data/photos.json'), 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: 'Failed to read photos data' });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Serve gallery page
app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gallery.html'));
});

// Server listens on port 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
