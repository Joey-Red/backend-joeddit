mongoose = require("mongoose");

const PinnedPostSchema = new mongoose.Schema({
  postBody: { type: String, required: true },
  postUser: { type: String, required: true },
  postUserId: { type: String, required: true },
  dateAdded: { type: String, required: true },
});

module.exports = mongoose.model("PersonalPost", PinnedPostSchema);
