const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve API routes
app.use('/api/v1', apiRoutes);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌾 KISAN SATHI (Farm Manage System) Platform Active 🌾`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🌍 Target Region: Abohar / Fazilka District, Punjab`);
  console.log(`=======================================================`);
});
