mongoose = require("mongoose");

const CommunitySchema = new mongoose.Schema({
  communityName: {
    type: String,
    lowercase: true,
    unique: [true, "Community taken"],
    required: [true, "can't be blank"],
    match: [/^[a-zA-Z0-9]+$/, "is invalid"],
    index: true,
    minLength: 3,
    maxLength: 25,
  },
  moderators: { type: Array, required: true },
  dateAdded: { type: String, required: true },
  img: {
    data: Buffer,
    contentType: String,
    required: false,
  },
});

module.exports = mongoose.model("Community", CommunitySchema);
