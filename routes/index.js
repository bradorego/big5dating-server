var express = require('express');
var router = express.Router();
var user = require('../models/user');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send('heartbeat');
});

router.get('/test', function (req, res, next) {
  firebaseRef.child('')
});

module.exports = router;
