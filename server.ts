import express from 'express';
import { createServer as createViteServer } from 'vite';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const app = express();

  // Increase payload limit for large projects with base64 images
  app.use(express.json({ limit: '50mb' }));

  // Initialize SQLite database
  // DATA_DIR allows mounting a persistent volume (e.g. Zeabur Volume at /data)
  const dataDir = process.env.DATA_DIR || __dirname;
  const db = await open({
    filename: path.join(dataDir, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Create table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // API Routes
  app.get('/api/settings', async (req, res) => {
    try {
      const rows = await db.all('SELECT key, value FROM settings');
      const settings = rows.reduce((acc: any, row) => {
        acc[row.key] = row.value;
        return acc;
      }, {});
      res.json(settings);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  app.post('/api/settings', async (req, res) => {
    try {
      const settings = req.body;
      for (const [key, value] of Object.entries(settings)) {
        await db.run(
          'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
          [key, value]
        );
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to save settings:', error);
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  app.get('/api/projects', async (req, res) => {
    try {
      const rows = await db.all('SELECT data FROM projects ORDER BY updatedAt DESC');
      const projects = rows.map(row => JSON.parse(row.data));
      res.json(projects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.post('/api/projects', async (req, res) => {
    try {
      const project = req.body;
      await db.run(
        'INSERT OR REPLACE INTO projects (id, data, updatedAt) VALUES (?, ?, ?)',
        [project.id, JSON.stringify(project), project.updatedAt || Date.now()]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to save project:', error);
      res.status(500).json({ error: 'Failed to save project' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    // SPA fallback: non-API routes serve index.html
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database at: ${path.join(dataDir, 'database.sqlite')}`);
  });
}

startServer().catch(console.error);
