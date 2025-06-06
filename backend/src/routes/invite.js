// routes/invite.js
const express = require('express');
const db      = require('../config/db'); // your SQLite handle

const router  = express.Router();

// define your invite endpoints, e.g.:
router.post('/', (req, res) => {
    console.log('Invite endpoint called');
  // create a token, insert into DB, send email…
  res.sendStatus(200);
});

module.exports = router;   // <-- this must export the router itself!
