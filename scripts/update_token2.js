const Database = require('better-sqlite3');

const NEW_TOKEN = 'EAAjkLPT8UegBSlTpJCzJozD4WojJ5v10uUXa5Th5B3MM4aWykYYSeMjXqM23XJ8UJD3nGUHeh06MlLZAgnQmZB7TaPghIFS8AhhyB9DgfZCn4XX1fd8IXtqNjm3UlT6uch8KNWT18su6Uvz3ZB8JYV7LUE0dfAmCgHrIo5nq40ZBCjZAKMH62hVxyHZBrmrYQgrPlCkEB6FUo5hW6S8pkA1ZAGVTboWvYaSM1JFEyM4ZD';
const PAGE2_ID = '133420039845881';

const db = new Database('./prisma/social_inbox.db');

// Before
const before = db.prepare("SELECT pageId, pageName, accessToken FROM ConnectedAccount WHERE pageId = ?").get(PAGE2_ID);
console.log('🔴 BEFORE:', before.pageName);
console.log('   Old token ends:', before.accessToken.slice(-25));

// Update
db.prepare("UPDATE ConnectedAccount SET accessToken = ?, updatedAt = ? WHERE pageId = ?")
  .run(NEW_TOKEN, new Date().toISOString(), PAGE2_ID);

// After
const after = db.prepare("SELECT pageId, pageName, accessToken FROM ConnectedAccount WHERE pageId = ?").get(PAGE2_ID);
console.log('\n✅ AFTER:', after.pageName);
console.log('   New token ends:', after.accessToken.slice(-25));
console.log('   Token starts:', after.accessToken.slice(0, 30));

db.close();
console.log('\n🎉 DB updated successfully!');
