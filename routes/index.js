var express = require('express');
var router = express.Router();
var user = require('../models/user');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send('heartbeat');
});

router.get('/test', function (req, res, next) {
  user.update({email: "test5@bradorego.com", friends: [{name: "Brad Orego", email: "me@bradorego.com"}, {name: "Test2 Testerson", email: "test2@bradorego.com"}, {name: "Test3 Testerson", email: "test3@bradorego.com"}, {name: "Test1 Testerson", email: "test1@bradorego.com"}, {name: "Test4 Testerson", email: "test4@bradorego.com"}]})
  res.send('done');
});

router.get('/friends', function (req, res, next) {
  user.getFriends({email: 'me@bradorego.com'})
    .then(function (friends) {
      console.log(friends);
      res.json(friends);
    });
});

router.get('/compare', function (req, res, next) {
  user.compare({email: 'me@bradorego.com'}, {email: 'test2@bradorego.com'})
    .then(function (corr) {
      console.log(corr);
      res.json(corr);
    });
});

router.get('/all', function (req, res, next) {
  user.all("n")
    .then(function (data) {
      res.json(data);
    });
});
module.exports = router;
