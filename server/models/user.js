const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');

var UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: '{VALUE} is not a valid email'
    }
  },
  password : {
    type: String,
    required: true,
    minlength: 6
  },
  tokens: [{
    access: {
      type: String,
      required: true
    },
    token: {
      type: String,
      required: true
    }
  }]
});

UserSchema.methods.toJSON = function() {
  var user = this;
  var userObj = user.toObject();
  return _.pick(userObj, ['_id', 'email']);
}

//generate token
UserSchema.methods.generateAuthToken = function() {
  var user = this;
  var access = 'auth';
  var token = jwt.sign({_id : user._id.toHexString(), access}, process.env.JWT_SECRET).toString();

  user.tokens.push({access, token});
  return user.save().then(() => {
    return token;
  });
};

UserSchema.methods.removeToken = function (token) {
  var user = this;
  return user.update({
      $pull : {
        tokens: {
          token
        }
      }
  });
};

UserSchema.statics.findByToken = function(token){
  var User = this;
  var decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return Promise.reject();
  }

  return User.findOne({
    '_id': decoded._id,
    'tokens.token': token,
    'tokens.access': 'auth'
  });
};

UserSchema.statics.findByCredentials = function(email, password) {
  var User = this;
  return User.findOne({email}).then((user) => {
    if(!user){
      return Promise.reject();
    }
    return new Promise((resolve, reject) => {
      return User.findOne({email}).then((user) => {
        bcrypt.compare(password, user.password, (err, res) => {
          if(res){
            return resolve(user);
          }
          reject(err);
        });
      }).catch((err) => res.status(400).send(err));

    });
  });
}

UserSchema.pre('save', function(next) {
  var user = this;

  if(user.isModified('password')){
    var pass = user.password;
    bcrypt.genSalt(10,(err, salt) => {
      bcrypt.hash(pass, salt, (err, hash) => {
        user.password = hash;
        next();
      })
    });
  }else{
    next();
  }
});

var User = mongoose.model('User', UserSchema);


module.exports = {
  User
}
