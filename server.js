const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const multer = require('multer');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'your_secret_key_here',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Multer setup for file uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'));
    }
  }
  // Removed fileSize limit
});

// Authentication middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.userEmail) {
    next();
  } else {
    res.redirect('/login');
  }
}

// Check if logged-in user is admin
function requireAdmin(req, res, next) {
  const adminEmail = 'seowmo@gmail.com';
  if (req.session && req.session.userEmail === adminEmail) {
    next();
  } else {
    res.status(403).send('Access denied');
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
  const { email } = req.body;
  if (!email) {
    return res.redirect('/login');
  }
  fs.readFile(path.join(__dirname, 'data/users.json'), 'utf8', (err, data) => {
    if (err) return res.status(500).send('Server error');
    const users = JSON.parse(data);
    const user = users.users.find(u => u.email === email);
    if (user) {
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

app.get('/photos', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'photos.html'));
});

app.get('/slideshow', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'slideshow.html'));
});

// Public API for photos - no login required
app.get('/api/photos', (req, res) => {
  const photosPath = path.join(__dirname, 'data/photos.json');
  fs.readFile(photosPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read photos data' });
    let photosObj = { photos: [] };
    try {
      photosObj = JSON.parse(data);
    } catch {
      photosObj = { photos: [] };
    }
    photosObj.photos = photosObj.photos.map(photo => ({
      filename: photo.filename,
      url: `/images/${photo.filename}`,
      timestamp: photo.timestamp || 0
    }));
    photosObj.photos.sort((a, b) => a.timestamp - b.timestamp);
    res.json(photosObj);
  });
});

// Upload photo - only admin
app.post('/upload-photo', requireAdmin, (req, res) => {
  upload.array('photo')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).send(`Upload error: ${err.message}`);
    } else if (err) {
      console.error('Unknown upload error:', err);
      return res.status(400).send(`Upload error: ${err.message}`);
    }

    if (!req.files || req.files.length === 0) {
      console.error('No files uploaded or invalid file types.');
      return res.status(400).send('No files uploaded or invalid file types. Only JPEG and PNG images are allowed.');
    }

    const photosPath = path.join(__dirname, 'data/photos.json');
    const newPhotoEntries = req.files.map(file => ({
      filename: file.originalname,
      url: `/images/${file.filename}`,
      timestamp: Date.now()
    }));

    fs.readFile(photosPath, 'utf8', (err, data) => {
      let photosObj = { photos: [] };
      if (!err) {
        try {
          photosObj = JSON.parse(data);
        } catch {
          photosObj = { photos: [] };
        }
      }

      photosObj.photos.push(...newPhotoEntries);

      fs.writeFile(photosPath, JSON.stringify(photosObj, null, 2), 'utf8', (err) => {
        if (err) {
          console.error('Error saving photo data:', err);
          return res.status(500).send('Error saving photo data');
        }
        res.redirect('/backoffice');
      });
    });
  });
});

// Remove photo
app.post('/remove-photo', requireLogin, (req, res) => {
  const filename = req.body.filename;
  if (!filename) return res.status(400).send('No filename provided');

  const photosPath = path.join(__dirname, 'data/photos.json');
  fs.readFile(photosPath, 'utf8', (err, data) => {
    let photosObj = { photos: [] };
    if (!err) {
      try {
        photosObj = JSON.parse(data);
      } catch {
        photosObj = { photos: [] };
      }
    }

    const photoIndex = photosObj.photos.findIndex(p => p.filename === filename);
    if (photoIndex === -1) return res.status(404).send('Photo not found');

    photosObj.photos.splice(photoIndex, 1);

    const photoFilePath = path.join(__dirname, 'public', 'uploads', filename);
    fs.unlink(photoFilePath, (unlinkErr) => {
      if (unlinkErr) console.error('Error deleting file:', unlinkErr);

      fs.writeFile(photosPath, JSON.stringify(photosObj, null, 2), 'utf8', (writeErr) => {
        if (writeErr) return res.status(500).send('Error saving photo data');
        res.redirect('/backoffice');
      });
    });
  });
});

// Protected image serving
app.get('/images/:filename', requireLogin, (req, res) => {
  const filename = req.params.filename;
  const options = { root: path.join(__dirname, 'public', 'uploads') };
  res.sendFile(filename, options, (err) => {
    if (err) res.status(404).send('Image not found');
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
