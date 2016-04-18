var express = require('express');
var router = express.Router();
var UserModel = require('../models/user');
var errorHandler = function (err) {
  res.status(err.status);
  res.send(err);
};

/* GET users listing. */
router.get('/', function(req, res, next) {
  console.log(req.body);
  res.send('respond with a resource');
});

router.put(function (req, res) {
  UserModel.login({email: req.body.email, password: req.body.password, increase: true})
    .then(function (data) {
      res.json(data);
    }, errorHandler);
});

router.post('/', function (req, res, next) { /// create users
  UserModel.create({email: req.body.email, password: req.body.password})
    .then(function (user) {
      console.log(user);
      res.json(user);
    }, errorHandler);
});

router.post('/survey', function (req, res, next) {
  UserModel.processSurvey(req.body)
    .then(function (data) {
      res.json(data);
    }, errorHandler);
});

module.exports = router;
