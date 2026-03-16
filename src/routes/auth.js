const express = require('express');
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

module.exports = router;