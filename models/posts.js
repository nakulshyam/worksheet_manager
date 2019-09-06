const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
	head: String,
	subhead: String,
	desc: String,
	upload_date: Date,
	due_date: Date,
	worksheet: String,
	teacher: {
		id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Teacher'
		},
		username: String
	}
});

module.exports = mongoose.model('Post', postSchema);
