const fs = require('fs');

const dbCode = [
  "const neo4j = require('neo4j-driver');",
  "",
  "const driver = neo4j.driver(",
  "  process.env.NEO4J_URI,",
  "  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)",
  ");",
  "",
  "module.exports = driver;"
].join('\n');

fs.writeFileSync('src/db.js', dbCode, 'utf8');
console.log('db.js fixed!');