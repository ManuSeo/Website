const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (form data)
app.use(session({
  secret: 'your_secret_key_here',
  resave: false,
  saveUninitialized: false
}));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Authentication middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.userEmail) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', (req, res) => {
  const email = req.body.email;
  if (!email) {
    return res.redirect('/login');
  }
  fs.readFile(path.join(__dirname, 'data/users.json'), 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Server error');
    }
    const users = JSON.parse(data);
    if (users.emails && users.emails.includes(email)) {
      req.session.userEmail = email;
      res.redirect('/gallery');
    } else {
      res.redirect('/login');
    }
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Protected Routes
app.get('/gallery', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gallery.html'));
});

app.get('/backoffice', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'backoffice.html'));
});

// API
app.get('/api/photos', (req, res) => {
  fs.readFile(path.join(__dirname, 'data/photos.json'), 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: 'Failed to read photos data' });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Server listens on port 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
