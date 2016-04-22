var express = require('express');
var router = express.Router();
var UserModel = require('../models/user');
var errorHandler = function (err, res) {
  console.log(err);
  res.status(err.status);
  res.send(err);
};

/* GET users listing. */
router.get('/', function(req, res, next) {
  UserModel.all()
    .then(function (data) {
      res.json(data);
    }, function (err) {
      errorHandler(err, res);
    });
});

router.put('/', function (req, res) {
  UserModel.login({email: req.body.email, password: req.body.password, increase: true})
    .then(function (data) {
      res.json(data);
    }, function (err) {
      errorHandler(err, res);
    });
});

router.post('/', function (req, res, next) { /// create users
  UserModel.create({email: req.body.email, password: req.body.password})
    .then(function (user) {
      console.log(user);
      res.json(user);
    }, function (err) {
      errorHandler(err, res);
    });
});

router.get('/friends', function (req, res, next) {
  UserModel.getFriends({email: req.query.email})
    .then(function (friends) {
      res.json(friends);
    }, function (err) {
      errorHandler(err, res);
    });
});

router.post('/survey', function (req, res, next) {
  UserModel.processSurvey(req.body)
    .then(function (data) {
      res.json(data);
    }, function (err) {
      errorHandler(err, res);
    });
});

router.post('/liked', function (req, res, next) {
  UserModel.like({email: req.body.from}, {email: req.body.to}, true)
    .then(function (data) {
      res.json(data);
    }, function (err) {
      errorHandler(err, res);
    });
});

router.post('/disliked', function (req, res, next) {
  UserModel.like({email: req.body.from}, {email: req.body.to}, false)
    .then(function (data) {
      res.json(data);
    }, function (err) {
      errorHandler(err, res);
    });
});

module.exports = router;
