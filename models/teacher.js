const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

var TeacherSchema = new mongoose.Schema({
	username: String,
	password: String
});

TeacherSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('Teacher', TeacherSchema);
