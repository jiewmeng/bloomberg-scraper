'use strict'

let app = require('koa')();
let router = require('koa-router')();
let views = require('koa-views');
let serve = require('koa-serve');
let bloomberg = require('./bloomberg');
let Promise = require('bluebird');
let parse = require('co-body');

bloomberg.startProcessing();

router.get('/', function *() {
	yield this.render('index.jade');
});

router.post('/api/search', function *() {
	let body = yield parse(this);

	if (!body.search) {
		this.status = 400;
		this.body = { message: 'Missing search param' }
		return;
	}

	let results = yield bloomberg.search(body.search);

	this.body = results;
})

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
