const fs = require('fs');

const authCode = `const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const driver = require('../db');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  const session = driver.session();
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await session.run(
      'CREATE (u:User {id: randomUUID(), email: $email, password: $hashed, name: $name, createdAt: datetime()}) RETURN u',
      { email, hashed, name }
    );
    const user = result.records[0].get('u').properties;
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists or invalid data' });
  } finally {
    await session.close();
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {email: $email}) RETURN u',
      { email }
    );
    if (result.records.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.records[0].get('u').properties;
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } finally {
    await session.close();
  }
});

module.exports = router;`;

const capsulesCode = `const express = require('express');
const driver = require('../db');
const jwt = require('jsonwebtoken');
const router = express.Router();

function auth(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.post('/', auth, async (req, res) => {
  const { title, message, unlockDate, imageUrl } = req.body;
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {id: $userId}) CREATE (c:Capsule {id: randomUUID(), title: $title, message: $message, unlockDate: date($unlockDate), imageUrl: $imageUrl, createdAt: datetime()}) CREATE (u)-[:CREATED]->(c) RETURN c',
      { userId: req.user.userId, title, message, unlockDate, imageUrl: imageUrl || '' }
    );
    res.json(result.records[0].get('c').properties);
  } finally {
    await session.close();
  }
});

router.get('/', auth, async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {id: $userId})-[:CREATED]->(c:Capsule) RETURN c ORDER BY c.createdAt DESC',
      { userId: req.user.userId }
    );
    const capsules = result.records.map(r => r.get('c').properties);
    res.json(capsules);
  } finally {
    await session.close();
  }
});

router.get('/:id', auth, async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (u:User {id: $userId})-[:CREATED]->(c:Capsule {id: $capsuleId}) RETURN c',
      { userId: req.user.userId, capsuleId: req.params.id }
    );
    if (result.records.length === 0) return res.status(404).json({ error: 'Capsule not found' });
    const capsule = result.records[0].get('c').properties;
    const unlockDate = new Date(capsule.unlockDate);
    if (new Date() < unlockDate) {
      return res.status(403).json({ error: 'Capsule is still locked', unlockDate });
    }
    res.json(capsule);
  } finally {
    await session.close();
  }
});

router.delete('/:id', auth, async (req, res) => {
  const session = driver.session();
  try {
    await session.run(
      'MATCH (u:User {id: $userId})-[:CREATED]->(c:Capsule {id: $capsuleId}) DETACH DELETE c',
      { userId: req.user.userId, capsuleId: req.params.id }
    );
    res.json({ message: 'Capsule deleted successfully' });
  } finally {
    await session.close();
  }
});

module.exports = router;`;

const dbCode = `const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

module.exports = driver;`;

fs.writeFileSync('src/db.js', dbCode);
fs.writeFileSync('src/routes/auth.js', authCode);
fs.writeFileSync('src/routes/capsules.js', capsulesCode);
console.log('All files created successfully!');