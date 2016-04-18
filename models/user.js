/// models/user.js

var firebase = require('firebase'),
  crypto = require('crypto'),
  $q = require('node-promise'),
  firebaseRef = new Firebase("https://big5dating.firebaseio.com/"),
  usersRef = firebaseRef.child('users'),
  userModel = {
    email: "",
    password: "",
    friends: [], /// who their FB? friends are
    surveyed: [], /// who they've already filled surveys for
    liked: [], /// who they've liked
    seen: [], /// who they've seen
    matches: [], /// who they've matched
    rating_avg: {o: 0, c: 0, e: 0, a: 0,  n: 0, },
    rating_count: 0,
    created: 0,
    lastSignIn: 0,
    signInCount: 0
  };

var extend = function (target, source) {
  for (var key in source) {
    // skip loop if the property is from prototype
    if (!source.hasOwnProperty(key)) continue;
    if (!target[key]) {
      target[key] = source[key];
    }
  }
};
var formatEmail = function (email) { /// from http://stackoverflow.com/a/14965065/1148769
  if (!email) return false;
  email = email.toLowerCase();
  email = email.replace(/\./g, ',');
  return email;
};

var getUserRef = function (userObj) {
  return usersRef.child(formatEmail(userObj.email));
};

var encryptPassword = function (password) {
  return crypto.createHash('sha1').update(password).digest('hex');
};

var User = function (obj) {
  extend(this, userModel);
  this.email = obj.email;
  this.password = encryptPassword(obj.password);
  this.created = +new Date();
  this.lastSignIn = +new Date();
  this.signInCount = 0;
};

var update = function (userObj, sendData) {
  var d = $q.defer(),
    user = getUserRef(userObj);
  user.update(userObj, function (error) {
    if (error) {
      return d.reject(error);
    }
    if (sendData) {
      return d.resolve(userObj);
    }
    return d.resolve({status: 200, message: "User updated"});
  });
  return d.promise;
};

var save = function (userObj) {
  var d = $q.defer(),
    user = getUserRef(userObj);
  user.set(userObj, function (error) {
    if (error) {
      return d.reject(error);
    }
    if (noSendData) {
      return d.resolve({status: 200, message: "User updated"});
    }
    return d.resolve(userObj);
  });
  return d.promise;
};

var create = function (userObj) {
  var d = $q.defer(),
    user = getUserRef(userObj);
  userObj = new User(userObj);
  get(userObj)
    .then(function (data) {
      return d.reject({status: 401, message: "Account with that email already exists"});
    }, function (err) {
      user.set(userObj, function (err) {
        if (err) {
          return d.reject(err);
        }
        get(userObj)
          .then(function (data) {
            return d.resolve(data);
          }, function (err) {
            return d.reject(err);
          });
      });
    });
  return d.promise;
};

var remove = function (userObj) {
  var d = $q.defer(),
    user = getUserRef(userObj);

  user.remove(function (err) {
    if (err) {
      return d.reject(err);
    }
    return d.resolve({status: 200, message: "Delete Successful"});
  })

  return d.promise;
};

var get = function (userObj) {
  var d = $q.defer(),
    user = getUserRef(userObj),
    output = {};
  usersRef.once('value', function (snapshot) {
    if (snapshot.child(formatEmail(userObj.email)).exists()) {
      snapshot.child(formatEmail(userObj.email)).forEach(function (obj) {
        output[obj.key()] = obj.val();
      });
      extend(output, userModel);
      return d.resolve(output);
    }
    return d.reject({'status': 404, 'message': 'Email Not Found'});
  });
  return d.promise;
};

var login = function (userObj) {
  var d = $q.defer(),
    user = getUserRef(userObj),
    output = {};
  user.once('value', function (snapshot) {
    snapshot.forEach(function (obj) {
      output[obj.key()] = obj.val();
    });
    if (!output.email) {
      return d.reject({'status': 404, 'message': 'Email Not Found'});
    }
    if (output.password !== encryptPassword(userObj.password)) {
      return d.reject({'status': 401, 'message': 'Incorrect password'});
    }
    extend(output, userModel);
    if (userObj.increase) {
      output.signInCount += 1;
      output.lastSignIn = +new Date();
    }
    update(output);
    return d.resolve(output);
  });
  return d.promise;
};


//// take in array of responses (q1-q10, values 1-5) and return object with appropriate values
var calculateSurvey = function (questions) {
  var openness = 0,
    conscientiousness = 0,
    extraversion = 0,
    agreeableness = 0,
    neuroticism = 0;
  extraversion = (6 - questions[0]) + questions[5]; /// 1R, 6
  agreeableness = questions[1] + (6 - questions[6]); /// 2, 7R
  conscientiousness = (6 - questions[2]) + questions[7]; /// 3R, 8
  neuroticism = (6 - questions[3]) + questions[8]; /// 4R, 9
  openness = (6 - questions[4]) + questions[9]; /// 5R, 10

  return {o: 0, c: 0, e: 0, a: 0, n: 0};
};

var processSurvey = function (surveyObj) {
  var d = $q.defer(),
    forUser = getUserRef({email: surveyObj.for}), /// be able to update the recipient
    fromUser = getUserRef({email: surveyObj.from}), /// be able to update the sender
    surveyResult = {};
  get(forUser) /// check if the recipient exists first
    .then(function (user) {
      surveyResult = calculateSurvey(surveyObj.questions);
    },
    function (err) {
      d.reject({'status': 404, 'message': 'User Not Found'});
    });
  return d.promise;
};

module.exports = {
  model: User,
  update: update,
  save: save,
  create: create,
  delete: remove,
  login: login,
  get: get
};
