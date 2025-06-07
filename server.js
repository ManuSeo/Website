// ... previous code unchanged

// Home page - public index with word map image
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// No redirects on '/'

// ... other routes remain unchanged
