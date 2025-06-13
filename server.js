const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies (form data)
app.use(session({
  secret: 'your_secret_key_here',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: (req, file, cb) => {
    // Keep original filename
    cb(null, file.originalname);
  }
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept JPEG and PNG only
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // Limit 5MB
  }
});

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

// New photos page
app.get('/photos', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'photos.html'));
});

// Slideshow pages
app.get('/slideshow', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'slideshow.html'));
});

app.get('/slideshow2', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'slideshow2.html'));
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

// New photo upload route accepting multiple files
app.post('/upload-photo', requireLogin, upload.array('photos'), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No files uploaded or invalid file types. Only JPEG and PNG images are allowed.');
  }
  const photosPath = path.join(__dirname, 'data/photos.json');

  // Prepare new entries
  const newPhotoEntries = req.files.map(file => ({
    filename: file.originalname,
    url: `/uploads/${file.filename}`
  }));

  // Read old photo list and append new entries
  fs.readFile(photosPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error saving photo data');
    }
    let photosObj = { photos: [] };
    try {
      photosObj = JSON.parse(data);
    } catch (e) {
      photosObj = { photos: [] };
    }
    photosObj.photos.push(...newPhotoEntries);
    fs.writeFile(photosPath, JSON.stringify(photosObj, null, 2), 'utf8', (err) => {
      if (err) {
        return res.status(500).send('Error saving photo data');
      }
      res.redirect('/backoffice');
    });
  });
});

// New photo removal route
app.post('/remove-photo', requireLogin, (req, res) => {
  const filename = req.body.filename;
  if (!filename) {
    return res.status(400).send('No filename provided');
  }

  const photosPath = path.join(__dirname, 'data/photos.json');
  fs.readFile(photosPath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Error reading photo data');
    }
    let photosObj = { photos: [] };
    try {
      photosObj = JSON.parse(data);
    } catch (e) {
      photosObj = { photos: [] };
    }

    const photoIndex = photosObj.photos.findIndex(p => p.filename === filename);
    if (photoIndex === -1) {
      return res.status(404).send('Photo not found');
    }

    photosObj.photos.splice(photoIndex, 1);

    const photoFilePath = path.join(__dirname, 'public/uploads', filename);
    fs.unlink(photoFilePath, (unlinkErr) => {
      if (unlinkErr) {
        console.error('Error deleting file:', unlinkErr);
      }
      fs.writeFile(photosPath, JSON.stringify(photosObj, null, 2), 'utf8', (writeErr) => {
        if (writeErr) {
          return res.status(500).send('Error saving photo data');
        }
        res.redirect('/backoffice');
      });
    });
  });
});

// Server listens on port 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
