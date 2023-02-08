mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  commentBody: { type: String, required: true },
  username: { type: String, required: true },
  userId: { type: String, required: true },
  parentId: { type: String, required: true },
  numLikes: { type: Number, required: true },
  likedByUsers: { type: Array, required: true },
  originalId: { type: String, required: true },
  dateAdded: { type: String, required: true },
});

module.exports = mongoose.model("Comment", CommentSchema);
