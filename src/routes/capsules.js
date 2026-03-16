const express = require('express');
const driver = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const router = express.Router();

function auth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch(e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

router.post('/', auth, async (req, res) => {
  const { title, message, unlockDate, imageUrl } = req.body;
  const userId = req.user.userId;
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {id: $userId}) CREATE (c:Capsule {id: randomUUID(), title: $title, message: $message, unlockDate: date($unlockDate), imageUrl: $imageUrl, createdAt: datetime()}) CREATE (u)-[:CREATED]->(c) RETURN c',
      { userId, title, message, unlockDate, imageUrl: imageUrl || '' }
    );
    res.json(result.records[0].get('c').properties);
  } catch(e) {
    console.error('Create capsule error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

router.get('/', auth, async (req, res) => {
  const userId = req.user.userId;
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {id: $userId})-[:CREATED]->(c:Capsule) RETURN c ORDER BY c.createdAt DESC',
      { userId }
    );
    const capsules = result.records.map(r => r.get('c').properties);
    res.json(capsules);
  } catch(e) {
    console.error('Get capsules error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

router.get('/:id', auth, async (req, res) => {
  const userId = req.user.userId;
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {id: $userId})-[:CREATED]->(c:Capsule {id: $capsuleId}) RETURN c',
      { userId, capsuleId: req.params.id }
    );
    if (result.records.length === 0) return res.status(404).json({ error: 'Capsule not found' });
    const capsule = result.records[0].get('c').properties;
    const unlockDate = new Date(capsule.unlockDate);
    if (new Date() < unlockDate) {
      return res.status(403).json({ error: 'Capsule is still locked', unlockDate });
    }
    res.json(capsule);
  } catch(e) {
    console.error('Get capsule error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

router.delete('/:id', auth, async (req, res) => {
  const userId = req.user.userId;
  const session = driver.session();
  try {
    await session.run(
      'MATCH (u:User {id: $userId})-[:CREATED]->(c:Capsule {id: $capsuleId}) DETACH DELETE c',
      { userId, capsuleId: req.params.id }
    );
    res.json({ message: 'Capsule deleted successfully' });
  } catch(e) {
    console.error('Delete capsule error:', e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

module.exports = router;