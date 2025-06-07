const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Session setup
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Storage setup for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Data file paths
const usersFile = path.join(__dirname, 'data', 'users.json');
const photosFile = path.join(__dirname, 'data', 'photos.json');

// Load authorized users
function loadUsers() {
  if (!fs.existsSync(usersFile)) {
    fs.mkdirSync(path.dirname(usersFile), { recursive: true });
    fs.writeFileSync(usersFile, JSON.stringify({ emails: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
}

// Save authorized users
function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Load photos metadata
function loadPhotos() {
  if (!fs.existsSync(photosFile)) {
    fs.mkdirSync(path.dirname(photosFile), { recursive: true });
    fs.writeFileSync(photosFile, JSON.stringify({ photos: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(photosFile, 'utf8'));
}

// Save photos metadata
function savePhotos(photos) {
  fs.writeFileSync(photosFile, JSON.stringify(photos, null, 2));
}

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session && req.session.email) {
    const users = loadUsers();
    const normalizedSessionEmail = req.session.email.trim().toLowerCase();
    if (users.emails.map(email => email.trim().toLowerCase()).includes(normalizedSessionEmail)) {
      return next();
    }
  }
  res.redirect('/login');
}

// Routes
// Login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Login processing
app.post('/login', (req, res) => {
  if (!req.body.email) return res.send('Email is required. <a href="/login">Try again</a>');

  const submittedEmail = req.body.email.trim().toLowerCase();
  const users = loadUsers();
  const normalizedUsers = users.emails.map(email => email.trim().toLowerCase());

  if (normalizedUsers.includes(submittedEmail)) {
    req.session.email = submittedEmail;
    res.redirect('/backoffice');
  } else {
    res.send('Unauthorized email. <a href="/login">Try again</a>');
  }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Backoffice page - manage photos and users
app.get('/backoffice', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'backoffice.html'));
});

// Upload photo
app.post('/upload-photo', isAuthenticated, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.send('No file uploaded.');
  }
  const photos = loadPhotos();
  photos.photos.push({ filename: req.file.filename, uploadedAt: new Date().toISOString() });
  savePhotos(photos);
  res.redirect('/backoffice');
});

// Manage authorized users
app.post('/add-user', isAuthenticated, (req, res) => {
  if (!req.body.email) return res.send('Email is required');
  const newEmail = req.body.email.trim().toLowerCase();
  const users = loadUsers();
  const normalizedUsers = users.emails.map(email => email.trim().toLowerCase());
  if (!normalizedUsers.includes(newEmail)) {
    users.emails.push(newEmail);
    saveUsers(users);
  }
  res.redirect('/backoffice');
});

app.post('/remove-user', isAuthenticated, (req, res) => {
  if (!req.body.email) return res.send('Email is required');
  const removeEmail = req.body.email.trim().toLowerCase();
  const users = loadUsers();
  users.emails = users.emails.filter(email => email.trim().toLowerCase() !== removeEmail);
  saveUsers(users);
  res.redirect('/backoffice');
});

// API to get users list as JSON
app.get('/api/users', isAuthenticated, (req, res) => {
  const users = loadUsers();
  res.json(users);
});

// Gallery page - accessible only to authorized users
app.get('/gallery', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gallery.html'));
});

// API to get photos list as JSON
app.get('/api/photos', isAuthenticated, (req, res) => {
  const photos = loadPhotos();
  res.json(photos);
});

// Home redirect to login (or gallery if logged in)
app.get('/', (req, res) => {
  if (req.session && req.session.email) {
    res.redirect('/gallery');
  } else {
    res.redirect('/login');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
