import express from 'express';
import { createServer as createViteServer } from 'vite';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
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
  let dataDir = process.env.DATA_DIR || __dirname;
  // Ensure data directory exists; fallback to __dirname if it can't be created
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {
    console.warn(`Cannot create DATA_DIR "${dataDir}", falling back to ${__dirname}`);
    dataDir = __dirname;
  }
  const dbPath = path.join(dataDir, 'database.sqlite');
  console.log(`Opening database at: ${dbPath}`);
  const db = await open({
    filename: dbPath,
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
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
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

  app.get('/api/customers', async (req, res) => {
    try {
      const rows = await db.all('SELECT data FROM customers ORDER BY updatedAt DESC');
      const customers = rows.map(row => JSON.parse(row.data));
      res.json(customers);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      res.status(500).json({ error: 'Failed to fetch customers' });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {
      const customer = req.body;
      if (!customer.id || !customer.name) {
        return res.status(400).json({ error: 'missing required customer fields: id, name' });
      }
      const updatedAt = customer.updatedAt || Date.now();
      await db.run(
        'INSERT OR REPLACE INTO customers (id, data, updatedAt) VALUES (?, ?, ?)',
        [customer.id, JSON.stringify({ ...customer, updatedAt }), updatedAt]
      );
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to save customer:', error);
      res.status(500).json({ error: 'Failed to save customer' });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    try {
      await db.run('DELETE FROM customers WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete customer:', error);
      res.status(500).json({ error: 'Failed to delete customer' });
    }
  });

  // Quick-create project via GET (for chatbot / web_fetch)
  app.get('/api/projects/create', async (req, res) => {
    try {
      const q = req.query as Record<string, string>;
      if (!q.name) {
        return res.status(400).json({ error: 'missing required param: name' });
      }
      const now = Date.now();
      const project = {
        id: String(now),
        customerId: q.customerId || '',
        name: q.name,
        client: q.client || '',
        date: q.date || new Date().toISOString().slice(0, 10),
        eventEndDate: q.eventEndDate || q.date || new Date().toISOString().slice(0, 10),
        location: q.location || '',
        contact: q.contact || '',
        phone: q.phone || '',
        taxId: q.taxId || '',
        activityTime: q.activityTime || '',
        moveInDate: q.moveInDate || '',
        moveOutDate: q.moveOutDate || '',
        period: 1,
        items: [],
        periodCharges: [{ id: '1', label: '活動日', type: 'rate', value: 1.0 }],
        subcontracts: [],
        taxRate: 0.05,
        updatedAt: now,
      };
      await db.run(
        'INSERT OR REPLACE INTO projects (id, data, updatedAt) VALUES (?, ?, ?)',
        [project.id, JSON.stringify(project), now]
      );
      res.json({ success: true, id: project.id });
    } catch (error) {
      console.error('Failed to quick-create project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  // Add item to project via GET (for chatbot / web_fetch)
  app.get('/api/projects/:id/add-item', async (req, res) => {
    try {
      const row = await db.get('SELECT data FROM projects WHERE id = ?', [req.params.id]);
      if (!row) {
        return res.status(404).json({ error: 'project not found' });
      }
      const project = JSON.parse(row.data);
      const q = req.query as Record<string, string>;
      if (!q.name) {
        return res.status(400).json({ error: 'missing required param: name' });
      }
      const newItem = {
        id: String(Date.now()),
        category: q.category || 'audio',
        name: q.name,
        quantity: parseInt(q.quantity || '1', 10),
        unit: q.unit || '式',
        price: parseInt(q.price || '0', 10),
        costPrice: parseInt(q.costPrice || '0', 10),
        note: q.note || '',
        internalOnly: q.internal === 'true',
        subItems: q.subItems ? q.subItems.split(',') : [],
      };
      project.items.push(newItem);
      project.updatedAt = Date.now();
      await db.run(
        'INSERT OR REPLACE INTO projects (id, data, updatedAt) VALUES (?, ?, ?)',
        [project.id, JSON.stringify(project), project.updatedAt]
      );
      res.json({ success: true, itemId: newItem.id });
    } catch (error) {
      console.error('Failed to add item:', error);
      res.status(500).json({ error: 'Failed to add item' });
    }
  });

  app.delete('/api/projects/:id', async (req, res) => {
    try {
      if (req.params.id === '_null') {
        await db.run('DELETE FROM projects WHERE id IS NULL');
      } else {
        await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
      }
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
    app.use((req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Database at: ${path.join(dataDir, 'database.sqlite')}`);
  });
}

startServer().catch(console.error);
