mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  postTitle: { type: String, required: false },
  postBody: { type: String, required: true },
  postUser: { type: String, required: true },
  postUserId: { type: String, required: true },
  numLikes: { type: Number, required: true },
  likedByUsers: { type: Array, required: true },
  numComments: { type: Number, required: true },
  dateAdded: { type: String, required: true },
  community: { type: String, required: true },
  img: {
    type: String,
    required: false,
  },
});

module.exports = mongoose.model("Post", PostSchema);
