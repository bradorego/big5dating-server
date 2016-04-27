/// chat.js
var firebase = require('firebase'),
  $q = require('node-promise'),
  firebaseRef = new Firebase("https://big5dating.firebaseio.com/"),
  chatsRef = firebaseRef.child('chats'),
  chatModel = {
    members: {},
    messages: {}
  },
  Chat = {};


Chat.get = function (id) {
  var d = $q.defer(),
    output = {};
  chatsRef.child(id).once('value', function (snapshot) {
    snapshot.forEach(function (obj) {
      output[obj.key()] = obj.val();
    });
    return d.resolve(output);
  });
  return d.promise;
};


Chat.post = function (obj) {
  var d = $q.defer();
  chatsRef.child(obj.id).child("messages").push(obj.message, function(error) {
    if (error) {
      return d.reject(error);
    } else {
      return d.resolve(obj);
    }
  });
  return d.promise;
};


module.exports = Chat;
