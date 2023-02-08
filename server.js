require("dotenv").config();
const { json } = require("express");
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcrypt");
const PORT = process.env.PORT || 8080;
const Post = require("./schematics/Post");
const User = require("./schematics/User");
const Comment = require("./schematics/Comment");
const Community = require("./schematics/Community");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const PersonalPost = require("./schematics/PersonalPost");
const MemoryStore = require("memorystore")(session);
const app = express();
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage").GridFsStorage;
const Grid = require("gridfs-stream");
// const methodOverride = require("method-override");
const bodyParser = require("body-parser");
const mongo = require("mongodb");
// Middleware
app.use(express.json());
app.use(
  session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
    resave: false,
    saveUninitialized: true,
    secret: "skillspecs",
  })
);
app.use(bodyParser.json());
// app.use(methodOverride("_method"));
app.use(cors());

// Connect to DB
const mongoDb = process.env.MONGODB_URI;
mongoose.set("strictQuery", false);
mongoose.connect(
  mongoDb,
  { useUnifiedTopology: true, useNewUrlParser: true },
  (err, client) => {
    if (err) {
      console.log(err);
      return;
    }
    console.log("DB Connected.");
  }
);
// const db = mongoose.connection;
const conn = mongoose.connection;
let gfs;
conn.once("open", () => {
  // Init stream
  // mongoDb
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("images"); //collection name
});
// const conn = mongoose.createConnection(process.env.MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });
// conn.once("open", () => {
//   (gfs = new mongoose.mongo.GridFSBucket(conn.db)),
//     {
//       bucketName: "images",
//     };
//   console.log("ig open? ", gfs);
// });

const storage = new GridFsStorage({
  url: process.env.MONGODB_URI,
  options: { useUnifiedTopology: true },
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "images",
        };
        // console.log(fileInfo);
        resolve(fileInfo);
      });
    });
  },
});

const store = multer({
  storage,
  limits: { fileSize: 20000000 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
});

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);
  if (mimetype && extname) return cb(null, true);
  cb("filetype");
}

const uploadMiddleware = (req, res, next) => {
  const upload = store.single("image");
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).send("File too large");
    } else if (err) {
      if (err === "filetype") return res.status(400).send("Image files only");
      return res.sendStatus(500);
    }
    next();
  });
};

// Passport
passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username: username }, (err, user) => {
      // console.log(user);
      if (err) {
        return done(err);
      }
      if (!user) {
        return done(null, false, { message: "Err" });
      }
      bcrypt.compare(password, user.password, (err, res) => {
        if (res) {
          // passwords match! log user in
          return done(null, user);
        } else {
          // passwords do not match!
          return done(null, false, {
            message: "Incorrect username or password.",
          });
        }
      });
    });
  })
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});
app.use(passport.initialize());
app.use(passport.session());

// Routes

// Verify token
app.post("/user/verify-token", (req, res, next) => {
  jwt.verify(req.body.token, process.env.SECRET_KEY, (err, authData) => {
    if (err) {
      return res.sendStatus(403);
    } else {
      return res.sendStatus(200);
    }
  });
});

// PHOTO STUFF
app.post("/upload/", uploadMiddleware, async (req, res) => {
  const { file } = req;
  const { id } = file;
  if (file.size > 5000000) {
    deleteImage(id);
    return res.status(400).send("file may not exceed 5mb");
  }
  // console.log("upload file: ", file);
  return res.send(file.id);
});

const deleteImage = (id) => {
  if (!id || id === "undefined") return res.status(400).send("no image id");
  const _id = new mongoose.Types.ObjectId(id);
  gfs.delete(_id, (err) => {
    if (err) return res.status(500).send("image deletion error");
  });
};

// app.get("/image/:id", ({ params: { id } }, res) => {
//   if (!id || id === "undefined") return res.status(400).send("no image id");
//   const _id = new mongoose.Types.ObjectId(id);
//   gfs.find({ _id }).toArray((err, files) => {
//     // console.log(gfs);
//     if (!files || files.length === 0)
//       return res.status(400).send("no files exist");
//     gfs.openDownloadStream(_id).pipe(res);
//   });
// });

let bucket;
(() => {
  mongoose.connection.on("connected", () => {
    bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "images",
    });
  });
})();
// app.get("/image/:id", async (req, res) => {
//   // try {
//   // const { fileId } = req.params.id;
//   const { fileId } = "63dc2e316b1197ebe51c0c97";
//   // Check if file exists
//   const file = await bucket
//     // 63dc2e316b1197ebe51c0c97
//     .find({ _id: new mongoose.Types.ObjectId(fileId) })
//     .toArray();
//   if (!file || file.length === 0 || file === null || file === undefined) {
//     return res.status(404).json({ error: { text: "File not found" } });
//   } else if (file && file.length !== 0 && file !== null) {
//     // set the headers
//     // res.set("Content-Type", file[0].contentType);
//     // res.set("Content-Disposition", `attachment; filename=${file[0].filename}`);
//     // create a stream to read from the bucket
//     const downloadStream = bucket.openDownloadStream(
//       new mongoose.Types.ObjectId(fileId)
//     );
//     // pipe the stream to the response
//     downloadStream.pipe(res);
//   }
//   // } catch (error) {
//   //   console.log(error);
//   //   res.status(400).json({ error: { text: `Unable to download file`, error } });
//   // }
//   // HERE^
//   // _id: req.params.id
//   // gfs.files.findOne({ _id: "63dc14031bd34a30393df31b" }, (err, file) => {
//   //   if (!file || file.length === 0) {
//   //     return res.status(404).json({ err: "No File Exists" });
//   //   } else {
//   //     // Check if is image
//   //     if (
//   //       file.contentType === "image/jpeg" ||
//   //       file.contentType === "image/png" ||
//   //       file.contentType === "gif"
//   //     ) {
//   //       // Read output to browser
//   //       const readstream = gfs.createReadStream(file._id);
//   //       readstream.pipe(res);
//   //     } else {
//   //       res.status(404).json({ err: "Not an image" });
//   //     }
//   //   }
//   // });
// });

app.get("/image/:id", async (req, res) => {
  try {
    // console.log(req.params.id);
    const fileId = req.params.id;
    // console.log(fileId);

    // Check if file exists
    const file = await bucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();
    if (file.length === 0 || file === null || file === undefined) {
      return res.status(404).json({ error: { text: "File not found" } });
    }

    // set the headers
    res.set("Content-Type", file[0].contentType);
    res.set("Content-Disposition", `attachment; filename=${file[0].filename}`);

    // create a stream to read from the bucket
    const downloadStream = bucket.openDownloadStream(
      new mongoose.Types.ObjectId(req.params.id)
    );

    // pipe the stream to the response
    downloadStream.pipe(res);
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: { text: `Unable to download file`, error } });
  }
});
// Sign Up
app.post("/user/sign-up", async (req, res, next) => {
  if (req.body.password.length < 6) {
    return res.json("Password must be at least 6 characters");
  }
  bcrypt.hash(req.body.password, 10, (err, hashedPassword) => {
    if (err) {
      return next(err);
    }
    const user = new User({
      username: req.body.username,
      password: hashedPassword,
      email: req.body.email,
      dateCreated: new Date(),
      roles: [],
    }).save((err) => {
      if (err) {
        return next(err);
      } else {
        res.json("Account created!");
      }
    });
  });
});

app.put("/update-password", function (req, res) {
  console.log(req.body);
  User.findOne({ _id: req.body.user._id }, (err, user) => {
    // console.log(user);
    // Check if error connecting
    if (err) {
      res.json({ success: false, message: err }); // Return error
    } else {
      // Check if user was found in database
      if (!user) {
        res.json({ success: false, message: "User not found" });
      } else {
        user.setPassword(
          //  req.body.oldPw,
          req.body.newPw,
          function (err) {
            if (err) {
              console.log(res.json(err));
            } else {
              user.save();
              res.status(200).json({
                message: "password reset successful",
              });
            }
          }
        );
      }
    }
  });
});

// Log in
app.post("/user/log-in", function (req, res, next) {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err || !user) {
      return res.status(400).json({
        message: "Something is not right",
        user: user,
      });
    }
    req.login(user, { session: false }, (err) => {
      if (err) {
        res.send(err);
      }
      const token = jwt.sign({ user }, process.env.SECRET_KEY, {
        expiresIn: "604800s",
      });
      const refreshToken = jwt.sign({ user }, process.env.SECRET_KEY, {
        expiresIn: "31536000s",
      });
      res.setHeader("Set-Cookie", refreshToken);
      return res.json({ user, token });
    });
  })(req, res);
});
// Log out
app.get("/user/log-out", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.sendStatus(200);
  });
});

// Get all communities
app.get("/retrieve-communities", (req, res) => {
  Community.find({})
    .sort({ $natural: -1 })
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      res.json(err);
    });
});

// Get all posts ( will have to limit it eventually )
app.get("/retrieve-posts", (req, res) => {
  Post.find({})
    .sort({ $natural: -1 })
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      res.json(err);
    });
});

// Get all posts ( will have to limit it eventually )
app.get("/retrieve-personal-posts", (req, res) => {
  // postUser: req.headers.user;
  PersonalPost.find({
    postUser: req.headers.user,
  })
    .sort({ $natural: 1 })
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      res.json(err);
    });
});

// Get comments (from specific parent)
app.get("/retrieve-comments", (req, res) => {
  // console.log(req.headers);
  Comment.find({ parentId: req.headers.postid })
    .then((result) => {
      // console.log(result);
      res.json(result);
    })
    .catch((err) => {
      res.json(err);
    });
});
// retrieve single post by ID
app.get("/retrieve-post", (req, res) => {
  Post.findOne({ _id: req.headers.clickedpostid }, (err, result) => {
    if (err) {
      res.json(err);
    } else {
      res.json(result);
    }
  });
});

// retrieve single post by community name
app.get("/retrieve-community-posts", (req, res) => {
  Post.find({ community: req.headers.community }, (err, result) => {
    // console.log(result);
    if (err) {
      res.json(err);
    } else {
      res.json(result);
    }
  });
});

// retrieve single post by user name
app.get("/u/", (req, res) => {
  Post.find({ postUser: req.headers.user }, (err, result) => {
    if (err) {
      res.json(err);
    } else {
      res.json(result);
    }
  });
});

// delete post by ID
app.delete("/delete-post/", verifyToken, (req, res) => {
  jwt.verify(req.token, process.env.SECRET_KEY, (err, authData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      if (req.headers.userid === req.headers.postuserid) {
        Post.deleteOne({ _id: req.headers.postid }, (err, result) => {
          if (err) {
            res.json(err);
          } else {
            res.json(result);
          }
        });
      } else {
        res.json("nope :)");
      }
    }
  });
});

// delete post by ID
app.delete("/delete-personal-post/", verifyToken, (req, res) => {
  jwt.verify(req.token, process.env.SECRET_KEY, (err, authData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      if (req.headers.userid === req.headers.postuserid) {
        PersonalPost.deleteOne({ _id: req.headers.postid }, (err, result) => {
          if (err) {
            res.json(err);
          } else {
            res.json(result);
          }
        });
      } else {
        res.json("nope :)");
      }
    }
  });
});

// Create Post
app.post("/create-post", verifyToken, (req, res, next) => {
  jwt.verify(req.token, process.env.SECRET_KEY, (err, authData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      const post = new Post({
        postTitle: req.body.postTitle,
        postBody: req.body.postBody,
        postUser: req.body.username,
        postUserId: req.body.postUserId,
        likedByUsers: [],
        numLikes: 0,
        numComments: 0,
        dateAdded: new Date(),
        community: req.body.community,
        img: req.body.img,
      }).save((err, obj) => {
        if (err) {
          return next(err);
        }
        res.status(200).json(obj);
      });
    }
  });
});

// Personal Post
app.post("/personal-post", verifyToken, (req, res, next) => {
  jwt.verify(req.token, process.env.SECRET_KEY, (err, authData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      const personalPost = new PersonalPost({
        postBody: req.body.postBody,
        postUser: req.body.username,
        postUserId: req.body.postUserId,
        dateAdded: new Date(),
      }).save((err) => {
        if (err) {
          return next(err);
        }
        res.json(200);
      });
    }
  });
});

// Create Community
app.post("/create-community", verifyToken, (req, res, next) => {
  jwt.verify(req.token, process.env.SECRET_KEY, (err, authData) => {
    if (err) {
      return res.sendStatus(403);
    } else {
      const community = new Community({
        communityName: req.body.community,
        moderators: [req.body.moderators],
        dateAdded: new Date(),
      }).save((err) => {
        if (err) {
          if (err.name === "MongoServerError" && err.code === 11000) {
            return res.json("Err 11000");
          } else {
            return res.json(200);
          }
        }
      });
    }
  });
});

// Comment
app.post("/create-comment", verifyToken, (req, res, next) => {
  jwt.verify(req.token, process.env.SECRET_KEY, (err, authData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      Post.updateOne(
        { _id: req.body.originalId },
        {
          $inc: { numComments: 1 },
        }
      ).then((result) => {
        // res.sendStatus(200);
        const comment = new Comment({
          commentBody: req.body.commentBody,
          username: req.body.username,
          userId: req.body.userId,
          parentId: req.body.parentId,
          originalId: req.body.originalId,
          numLikes: 0,
          likedByUsers: [],
          dateAdded: new Date(),
        }).save((err, data) => {
          if (err) {
            return next(err);
          }
          res.json(data);
        });
      });
    }
  });
});

// Like Post
app.post("/like-post", (req, res) => {
  Post.updateOne(
    { _id: req.body.postId, likedByUsers: { $ne: req.body.userId } },
    {
      $push: { likedByUsers: req.body.userId },
      $inc: { numLikes: 1 },
    }
  ).then((result) => {
    res.sendStatus(200);
  });
});

// unlike Post
app.post("/unlike-post", (req, res) => {
  Post.updateOne(
    // update?? aggregate?? find??

    { _id: req.body.postId, likedByUsers: { $eq: req.body.userId } },
    {
      $pull: { likedByUsers: req.body.userId },
      $inc: { numLikes: -1 },
    }
  )
    .then((result) => {
      res.sendStatus(200);
    })
    .catch((err) => {
      res.json(err);
    });
});

// Like / Unlike Comments
// Like Post
app.post("/like-comment", (req, res) => {
  Comment.updateOne(
    { _id: req.body.postId, likedByUsers: { $ne: req.body.userId } },
    {
      $push: { likedByUsers: req.body.userId },
      $inc: { numLikes: 1 },
    }
  ).then((result) => {
    // console.log(result);
    res.sendStatus(200);
  });
});

// unlike Post
app.post("/unlike-comment", (req, res) => {
  Comment.updateOne(
    // update?? aggregate?? find??

    { _id: req.body.postId, likedByUsers: { $eq: req.body.userId } },
    {
      $pull: { likedByUsers: req.body.userId },
      $inc: { numLikes: -1 },
    }
  )
    .then((result) => {
      res.sendStatus(200);
    })
    .catch((err) => {
      res.json(err);
    });
});

// Delete Post
app.delete("/delete-post", verifyToken, (req, res, next) => {
  Post.findByIdAndRemove(req.body.postId, function deleteMessage(err) {
    if (err) {
      return res.sendStatus(err);
    }
    res.sendStatus(200);
  });
});
// Functions
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token === null) return res.setStatus(401);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = user;
    next();
  });
}
// function generateAccessToken(user) {
//   return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
//     expiresIn: "15s",
//     // expiresIn: "15m",
//   });
// }
// Verify Token
function verifyToken(req, res, next) {
  // console.log(req.headers);
  // Get auth header value
  const bearerHeader = req.headers["authorization"];
  // Check if bearer is undefined
  if (typeof bearerHeader !== "undefined") {
    // Split at the space
    const bearer = bearerHeader.split(" ");
    // Get token from array
    const bearerToken = bearer[1];
    //Set the token
    req.token = bearerToken;
    //Call next
    next();
  } else {
    // Forbidden
    res.sendStatus(403);
  }
}

app.listen(8080, () => console.log("server is running"));
