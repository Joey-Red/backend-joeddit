mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    lowercase: true,
    unique: [true, "Username taken"],
    required: [true, "can't be blank"],
    match: [/^[a-zA-Z0-9]+$/, "is invalid"],
    index: true,
    minLength: 3,
    maxLength: 15,
  },
  password: { type: String, required: true },
  email: {
    type: String,
    lowercase: true,
    unique: [true, "email taken"],
    required: [true, "can't be blank"],
    match: [/\S+@\S+\.\S+/, "is invalid"],
    index: true,
  },
  dateCreated: { type: String, required: true },
  roles: { type: Array, required: true },
});
UserSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("User", UserSchema);
