var mongoose = require('mongoose');
// mongoose.connect('mongodb://jiewmeng:U4nTrcMrqqFg@ds035653.mongolab.com:35653/bloomberg-scrape-app');
mongoose.connect('mongodb://127.0.0.1:27017/bloomberg-scrape-app', {
	server: {
		poolSize: 20
	}
});
mongoose.Promise = require('bluebird');

var companySchema = new mongoose.Schema({
	name: String,
	url: String,
	profile: String,
	lastUpdate: Date
});

var company = mongoose.model('Company', companySchema);

var progressSchema = new mongoose.Schema({
	type: String,
	letter: String,
	page: Number,
	allDone: Boolean,
	doneListing: Boolean
});

var progress = mongoose.model('Progress', progressSchema);

module.exports = {
	mongoose: mongoose,
	models: {
		Company: company,
		Progress: progress
	}
};
