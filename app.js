// ==========Require npm packages ==========
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const methodOverride = require('method-override');
const path = require('path');
const crypto = require('crypto');
const morgan = require('morgan');
const assert = require('assert');
const mongoose = require('mongoose');
const expressSession = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
// ==========================================

// =========== Schema setup ==========
const Post = require('./models/posts');
const Teacher = require('./models/teacher');
// =====================================

// =========== Create Mongo Connection ==============
const mongoURI = 'mongodb://localhost:27017/igcse';
const conn = mongoose.createConnection(mongoURI);
// ==================================================

// ============== Initialize gfs ===============
let gfs;

conn.once('open', () => {
	// Init stream
	gfs = Grid(conn.db, mongoose.mongo);
	gfs.collection('uploads');
	console.log('/files is okay now');
});
// ==============================================

mongoose.connect(mongoURI);
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // exposes body of a request to req.body
app.set('view engine', 'ejs'); // sets the view engine to use ejs by default
app.use(express.static(__dirname + '/public')); // sets the application to use pub_dir for frontend peripherals
app.use(methodOverride('_method')); // enables methods not supported by html5 forms

// =========== Passport Configuration =========
app.use(
	expressSession({
		secret: '404 error: not found',
		resave: false,
		saveUninitialized: false
	})
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(Teacher.authenticate()));

passport.serializeUser(Teacher.serializeUser());
passport.deserializeUser(Teacher.deserializeUser());

app.use(function(req, res, next) {
	res.locals.currentUser = req.user;
	next();
});
// =============================================

// ============= Create Storage Engine ===============
const storage = new GridFsStorage({
	url: mongoURI,
	file: (req, file) => {
		return new Promise((resolve, reject) => {
			crypto.randomBytes(16, (err, buf) => {
				if (err) {
					return reject(err);
				}
				filename = buf.toString('hex') + path.extname(file.originalname);
				const fileInfo = {
					filename: filename,
					bucketName: 'uploads'
				};
				console.log(fileInfo);
				resolve(fileInfo);
			});
		});
	}
});
const upload = multer({ storage });
// ====================================================

//=============== Routes =================
//Root route
app.get('/', function(req, res) {
	res.render('index');
});

//GET posts
app.get('/posts', function(req, res) {
	Post.find({}, function(err, allposts) {
		if (err) {
			console.log(err);
		} else {
			res.render('Posts', { posts: allposts });
		}
	});
});

// POST posts
app.post('/posts', upload.single('worksheet'), function(req, res) {
	console.log(filename);
	const head = req.body.head;
	const subhead = req.body.subhead;
	const desc = req.body.desc;
	const teacher = {
		id: req.user._id,
		username: req.user.username
	};
	const newpost = { head: head, subhead: subhead, desc: desc, worksheet: filename, teacher: teacher };
	console.log(newpost);
	Post.create(newpost, function(err, newlyCreated) {
		if (err) {
			console.log(err);
		} else {
			res.redirect('/posts');
		}
	});
});

//GET new post for
app.get('/posts/new', isLoggedIn, function(req, res) {
	res.render('newpost');
});

app.get('/posts/:id', function(req, res) {
	Post.findById(req.params.id, function(err, foundpost) {
		if (err) {
			console.log(err);
		} else {
			gfs.files.findOne({ filename: foundpost.worksheet }, (err, file) => {
				if (!file || file.length === 0) {
					return res.status(404).json({
						err: 'No Worksheet Exist'
					});
				}
				res.render('show', { post: foundpost });
			});
		}
	});
});

app.get('/posts/worksheet/:filename', (req, res) => {
	gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
		if (!file || file.length === 0) {
			return res.status(404).json({
				err: 'No file Exist'
			});
		}
		// File exists
		if (file.contentType === 'application/pdf' || file.contentType === 'image/*') {
			// read output
			const readstream = gfs.createReadStream(file.filename);
			readstream.pipe(res);
		} else {
			res.status(404).json({ err: 'not an image' });
		}
	});
});

// DELETE post
app.delete('/posts/:id', checkPostOwnership, function(req, res) {
	Post.findByIdAndDelete(req.params.id, function(err) {
		if (err) {
			res.redirect('/posts');
		} else {
			res.redirect('/posts');
		}
	});
});

// GET edit form
app.get('/posts/:id/edit', checkPostOwnership, function(req, res) {
	Post.findById(req.params.id, function(err, foundpost) {
		res.render('edit', { post: foundpost });
	});
});

// UPDATE post
app.put('/posts/:id', function(req, res) {
	Post.findByIdAndUpdate(req.params.id, req.body.post, function(err, updatedpost) {
		if (err) {
			res.redirect('/posts');
		} else {
			res.redirect('/posts/' + req.params.id);
		}
	});
});
// ===========================================

// GET students
app.get('/students', function(req, res) {
	res.render('students');
});

// ===========================================

// GET register
app.get('/register', function(req, res) {
	res.render('register');
});

// POST register
app.post('/register', function(req, res) {
	var newUser = new Teacher({ username: req.body.username });
	Teacher.register(newUser, req.body.password, function(err, user) {
		if (err) {
			console.log(err);
			return res.render('register');
		}
		passport.authenticate('local')(req, res, function() {
			res.redirect('/posts');
		});
	});
});

// GET login form
app.get('/login', function(req, res) {
	res.render('login');
});

// POST login
app.post(
	'/login',
	passport.authenticate('local', {
		successRedirect: '/posts',
		failureRedirect: '/login'
	}),
	function(req, res) {}
);

// GET logout
app.get('/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});

// =================Middleware===================

function isLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}
	res.redirect('/login');
}

function checkPostOwnership(req, res, next) {
	if (req.isAuthenticated()) {
		Post.findById(req.params.id, function(err, foundPost) {
			if (err) {
				// req.flash("error", "Post not found");
				res.redirect('back');
			} else {
				if (!foundPost) {
					// req.flash("error", "Item not found.");
					return res.redirect('back');
				}
				if (foundPost.teacher.id.equals(req.user._id)) {
					next();
				} else {
					// req.flash("error", "You don't have permission to do that!");
					res.redirect('back');
				}
			}
		});
	} else {
		// req.flash("error", "You need to be logged in to do that!");
		res.redirect('back');
	}
}

// =================================================

// ========= Listen for Connection =================

app.listen(process.env.PORT || 3000, process.env.IP, function() {
	console.log('Hosting server on localhost:3000');
});

// =================================================
