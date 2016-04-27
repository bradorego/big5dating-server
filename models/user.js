/// models/user.js

var firebase = require('firebase'),
  crypto = require('crypto'),
  $q = require('node-promise'),
  correlation = require('node-correlation'),
  firebaseRef = new Firebase("https://big5dating.firebaseio.com/"),
  usersRef = firebaseRef.child('users'),
  userModel = {
    email: "",
    password: "",
    friends: [], /// who their FB? friends are
    rated: [], /// who they've already filled surveys for
    liked: [], /// who they've liked
    seen: [], /// who they've seen
    matched: [], /// who they've matched
    rating_avg: {o: 0, c: 0, e: 0, a: 0,  n: 0, },
    rating_count: 0,
    created: 0,
    lastSignIn: 0,
    signInCount: 0
  };

/// used to ensure the full object is returned to client so we don't have to watch for edge cases
var extend = function (target, source) {
  for (var key in source) {
    // skip loop if the property is from prototype
    if (!source.hasOwnProperty(key)) continue;
    if (!target[key]) {
      target[key] = source[key];
    }
  }
};
/// firebase doesn't accept dots, so convert those to commas
var formatEmail = function (email) { /// from http://stackoverflow.com/a/14965065/1148769
  if (!email) return false;
  email = email.toLowerCase();
  email = email.replace(/\./g, ',');
  return email;
};

/// return a firebase reference to the specific user
/// userObj.email === user's email
var getUserRef = function (userObj) {
  return usersRef.child(formatEmail(userObj.email));
};

/// run the same encryption for creation, sign in
var encryptPassword = function (password) {
  return crypto.createHash('sha1').update(password).digest('hex');
};

/// used to create a new user object
/// obj.email === email to use, obj.password === password to encrypt
var User = function (obj) {
  extend(this, userModel);
  this.email = obj.email;
  this.password = encryptPassword(obj.password);
  this.created = +new Date();
  this.lastSignIn = +new Date();
  this.signInCount = 0;
};

/// return all users in the list
/// dimension - optional property to organize by
var all = function (dimension) {
  var d = $q.defer(),
    output = [],
    ref = usersRef;
  if (dimension) {
    ref = ref.orderByChild("rating_avg/" + dimension);
  }
  ref.limitToLast(100).once('value', function (snapshot) {
    snapshot.forEach(function (obj) {
      output.push(obj.val());
    });
    if (dimension) {
      output.reverse();
    }
    d.resolve(output);
  });
  return d.promise;
};

/// used to update a user record
/// userObj - the user to be updated. Used to pull email as well as provide data
/// sendData - optional param to potentially save bandwidth
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

/// used to overwrite a user record (probably has no real application)
/// userObj - user object to overwrite; email pulled out and data will be overwritten
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

/// used to create a new user
/// userObj.email === user's email
/// userObj.password === user's password
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

/// used to delete users outright (probably also never used)
/// userObj - user to be removed. Email will be extracted and record will be removed
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

/// used to get a user record (without checking password/etc)
/// userObj.email == user record to get
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

/// used to register a login for a user. Will update signInCount and lastSignIn
/// userObj.email === user object to log in
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

  return {o: openness, c: conscientiousness, e: extraversion, a: agreeableness, n: neuroticism};
};
/// from http://stackoverflow.com/a/16757630/1148769
/// sample: latest entry (obj); count: # of previous ratings; avg: current averages (obj)
var calculateRollingAvg = function (obj) {
  if (obj.count > 0) {
    /// do it 5 times (one for each entry)
    obj.avg.o -= (obj.avg.o / obj.count);
    obj.avg.o += (obj.sample.o / obj.count);

    obj.avg.c -= (obj.avg.c / obj.count);
    obj.avg.c += (obj.sample.c / obj.count);

    obj.avg.e -= (obj.avg.e / obj.count);
    obj.avg.e += (obj.sample.e / obj.count);

    obj.avg.a -= (obj.avg.a / obj.count);
    obj.avg.a += (obj.sample.a / obj.count);

    obj.avg.n -= (obj.avg.n / obj.count);
    obj.avg.n += (obj.sample.n / obj.count);
    /// thank god for mnemonics
  } else {
    obj.avg = obj.sample;
  }
  return obj.avg;
};

/// take a survey object from the front end and do the appropriate math/user record updates
/// surveyObj.from === user submitting survey
/// surveyObj.for === user survey is being filled for
/// questions === array of responses to questions
var processSurvey = function (surveyObj) {
  var d = $q.defer(),
    // forUser = getUserRef({email: surveyObj.for}), /// be able to update the recipient
    // fromUser = getUserRef({email: surveyObj.from}), /// be able to update the sender
    surveyResult = {},
    updatedUser = {};
  $q.all([
    get({email: surveyObj.for}),
    get({email: surveyObj.from})
  ]).then(function (users) { /// [0] === for, [1] === from
      if (users[1].rated.indexOf(surveyObj.for) !== -1) { /// if they've already rated, reject
        return d.reject({status: 400, message: "Already rated this friend"});
      }
      var i = 0;
      surveyResult = calculateSurvey(surveyObj.questions); /// process survey responses into proper data
      users[0].rating_count += 1; /// increase the count, naturally
      users[0].rating_avg = calculateRollingAvg({sample: surveyResult, count: users[0].rating_count, avg: users[0].rating_avg}); /// update the rolling average with the latest sample
      for (i = 0; i < users[1].friends.length; i++) {
        if (users[1].friends[i].email === surveyObj.for) {
          users[1].friends.splice(i, 1); /// remove from friend list so they don't try to fill out survey again
          break;
        }
      }
      users[1].rated.push(surveyObj.for); /// add them to the rated list
      update(users[0]); /// update recipient's scores
      update(users[1]); /// update sender's rated list
      return d.resolve(users[1]); /// return updated sender object to client
    },
    function (err) {
      return d.reject({'status': 404, 'message': 'User Not Found'});
    });
  return d.promise;
};

/// get a list of the user's current friends (so we know who needs to be surveyed - might not be used because friends are on user object)
/// userObj.email === user to get friends of
var getFriends = function (userObj) {
  var d = $q.defer(),
    friends = [],
    friendsRef = getUserRef(userObj).child('friends');
  friendsRef.once('value', function (snapshot) {
    snapshot.forEach(function (obj) {
      friends.push(obj.val());
    });
    return d.resolve(friends);
  });
  return d.promise;
};

/// do math to turn the correlation value (-1..1) to a "percentage" (0..100)
/// userA = user object
/// userB = other user object
var compareScores = function (userA, userB) {
  var scoresA = Object.keys(userA.rating_avg).map(function(k) { return userA.rating_avg[k]; }),
    scoresB = Object.keys(userB.rating_avg).map(function(k) { return userB.rating_avg[k]; });
  return ((correlation.calc(scoresA, scoresB) * 100) + 100) / 2;
};

/// get today's 10 matches for a given user
/// userObj.email === user to get matches for
var getMatches = function (userObj) {
  var d = $q.defer(),
    dimensions = ["o", "c", "e", "a", "n"];
  $q.all([
    get({email: userObj.email}),
    all(dimensions[Math.floor(Math.random() * 5)]) /// for now, pick a random dimension to keep it interesting
  ]).then(function (obj) { //// [0] === user, [1] === all
    /// now, remove users that have already been seen
    var i = 0,
      j = 0,
      alreadySeen = false,
      user = obj[0],
      allUsers = obj[1],
      matches = []; /// pull the first 10 values
    for (i = 0; i < allUsers.length; i++) { /// for all users
      alreadySeen = false;
      if (user.email === allUsers[i].email) {
        continue; ///ignore yourself, silly
      }
      for (j = 0; j < user.seen.length; j++) { /// for user's seen list
        if (user.seen[j] === allUsers[i].email) {
          alreadySeen = true;
        }
      }
      if (!alreadySeen) {
        allUsers[i].matchPercentage = compareScores(user, allUsers[i]);
        matches.push(allUsers[i]);
      }
      if (matches.length === 10) { /// escape once we hit 10
        break;
      }
    }
    return d.resolve(matches);
  }, function (err) {
    console.warn(err);
    return d.reject(err);
  })
  return d.promise;
};

/// register a like for a user
/// currentUser.email === signed in user
/// viewedUser.email === user being liked/disliked
/// liked === whether or not the user is liked
//// TODO - figure out why self is in like/match list
var liked = function (currentUser, viewedUser, liked) {
  var d = $q.defer(),
    matched = false;
  $q.all([
    get({email: currentUser.email}),
    get({email: viewedUser.email})
  ]).then(function (obj) { /// [0] === current, [1] === viewed
      if (obj[0].seen.indexOf(viewedUser.email) !== -1) {
        return d.reject({status: 400, message: "User already seen. Ignoring"});
      }
      obj[0].seen.push(viewedUser.email); /// add to the seen list either way
      if (liked) { /// if liked, add it to the liked list
        obj[0].liked.push(viewedUser.email);
        if (obj[1].liked.indexOf(currentUser.email) !== -1) { /// woot
          obj[0].matched.push(viewedUser.email);
          obj[1].matched.push(currentUser.email);
          matched = true;
        }
      }
      update(obj[0]); /// update user with seen, liked, matched
      if (liked) {
        update(obj[1]); /// only thing changed is if they matched
      }
      return d.resolve({user: obj[0], matched: matched}); /// client should already know, but just in case...
    }, function (err) {
      return d.reject(err);
    });
  return d.promise;
};

/// export a bunch of stuff
module.exports = {
  model: User,
  update: update,
  save: save,
  create: create,
  delete: remove,
  login: login,
  get: get,
  processSurvey: processSurvey,
  all: all,
  getFriends: getFriends,
  matches: getMatches,
  like: liked
};
