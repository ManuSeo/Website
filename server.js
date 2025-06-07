const express = require('express');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
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
    if (users.emails.includes(req.session.email)) {
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
  const { email } = req.body;
  const users = loadUsers();
  if (users.emails.includes(email)) {
    req.session.email = email;
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
  const { email } = req.body;
  if (!email) return res.send('Email is required');
  const users = loadUsers();
  if (!users.emails.includes(email)) {
    users.emails.push(email);
    saveUsers(users);
  }
  res.redirect('/backoffice');
});

app.post('/remove-user', isAuthenticated, (req, res) => {
  const { email } = req.body;
  if (!email) return res.send('Email is required');
  const users = loadUsers();
  users.emails = users.emails.filter(e => e !== email);
  saveUsers(users);
  res.redirect('/backoffice');
});

// Gallery page - accessible only to authorized users
app.get('/gallery', isAuthenticated, (req, res) => {
  const photos = loadPhotos();
  let photoImgs = photos.photos.map(p => `<img src="/uploads/${p.filename}" style="max-width:300px;margin:10px;" />`).join('\n');
  const html = `
  <h1>Photo Gallery</h1>
  <p><a href="/logout">Logout</a></p>
  <div>${photoImgs}</div>
  `;
  res.send(html);
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
