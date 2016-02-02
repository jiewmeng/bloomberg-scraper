'use strict'

let app = require('koa')();
let router = require('koa-router')();
let views = require('koa-views');
let serve = require('koa-serve');
let bloomberg = require('./bloomberg');

router.get('/', function *() {
	yield this.render('index.jade');
});

router.get('/bloomberg/updateCompanies', function *() {
	bloomberg.scrapeAll('private');
	yield this.redirect('/');
});

router.get('/bloomberg/populateProfiles', function *() {
	bloomberg.scrapeCompanies();
	yield this.redirect('/');
});

app.use(views(__dirname + '/views', {
	map: {
		jade: 'jade'
	}
}));
app.use(serve('static'));
app.use(router.routes());
app.use(router.allowedMethods());



let port = process.env.PORT || 8000;
app.listen(port);
console.log(`Listening on port ${port}`);
