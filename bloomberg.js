'use strict';

const LISTING_URL = 'http://www.bloomberg.com/research/common/symbollookup/symbollookup.asp?lookuptype=private&region=all&letterIn=X';

var x = new require('x-ray')();
var Promise = require('bluebird');

var _getLisingUrl = function(type, startsWith, page) {
	var firstRow = (page - 1) * 180;
	var url = `http://www.bloomberg.com/research/common/symbollookup/symbollookup.asp?region=all&lookuptype=${type}&region=all&letterIn=${startsWith}&firstrow=${firstRow}`;
	return url;
};
var Company = require('./db').models.Company;
var Progress = require('./db').models.Progress;

module.exports = {

	/**
	 * Scrape company URL for company description
	 *
	 * @param  {String} url
	 * @return {Promise} resolved to company description
	 */
	scrapeCompany: function(url) {
		return Promise.promisify(x(url, {
			privateProfile: '#bDesc',
			publicProfile: '.profile__description'
		}))()
			.then(function(res) {
				if (res.privateProfile) return res.privateProfile;
				return res.publicProfile;
			})
			.catch(function(err) {
				console.error(`error scrapping company ${url}`);
				console.error(err.stack);
				return null;
			});
	},

	/**
	 * Scrape for company URLs only
	 */
	scrapeAll: function(type) {
		console.log('TRIGGERED SCRAPE ALL')
		let startingCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

		return Promise.map(startingCharacters, (letter) => {
			return Progress.findOne({
				type: type,
				letter: letter
			})
				.then((progress) => {
					let page = 1;
					if (progress && progress.doneListing !== true) {
						page = parseInt(progress.page) + 1;
					} else if (progress && progress.doneListing === true) {
						console.log(`Finished processing ${type}, ${letter}`);
						return;
					}

					return this.scrapeListingRecursive(type, letter, page);
				});
		});
	},

	scrapeListingRecursive: function(type, startsWith, page) {
		return this.scrapeListing(type, startsWith, page)
			.then((url) => {
				if (url)
					return this.scrapeListingRecursive(type, startsWith, page + 1);
				return Progress.update(
					{ type: type, letter: startsWith },
					{ type: type, letter: startsWith, page: page, doneListing: true }
				)
					.then(() => console.log(`done with ${type}, ${startsWith}, ${page}`));
			});
	},

	/**
	 * Scrapes company listing page
	 *
	 * @param  {String} type one of private, public
	 * @param  {String} startsWith starting character of company eg. A
	 * @param  {Number} page the page number eg. 1
	 * @return {Promise} resolved to nextPageUrl when all companies saved to DB
	 */
	scrapeListing: function(type, startsWith, page) {
		let nextUrl;
		// scrape listing page
		console.log(`Scraping Type: ${type}, Starts with: ${startsWith}, Page: ${page}`);
		console.time(`scrape:${type}-${startsWith}-${page}`);
		return Promise.promisify(x(_getLisingUrl(type, startsWith, page), {
			nextPageUrl: '.paging .nextBtnActive',
			rows: x('#columnLeft table tbody tr', [{
				title: 'td:nth-child(1)',
				url: 'td:nth-child(1) a@href'
			}])
		}))()
			.then((res) => {
				console.timeEnd(`scrape:${type}-${startsWith}-${page}`);
				console.log(`>>> Got response for ${type}, Starts with: ${startsWith}, Page: ${page}`);
				nextUrl = res.nextPageUrl;

				let date = new Date();
				console.time(`map:${type}-${startsWith}-${page}`);
				let companies = res.rows.map((row) => {
					if (!row.url) return undefined;
					return {
						name: row.title,
						url: row.url,
						lastUpdate: date
					};
				});
				companies = companies.filter(company => !!company.url);
				console.timeEnd(`map:${type}-${startsWith}-${page}`);

				return new Promise((resolve, reject) => {
					console.time(`save:${type}-${startsWith}-${page}`);
					Company.collection.insert(companies, {
						ordered: false
					}, (err) => {
						console.timeEnd(`save:${type}-${startsWith}-${page}`);
						if (err) return reject(err);
						resolve();
					});
				});


				// just save URLs
				// return Promise.map(res.rows, (row) => {
				// 	return Company.update(
				// 		{ url: row.url },
				// 		{ url: row.url, name: row.title },
				// 		{ upsert: true }
				// 	);
				// });

				// let bulk = Company.collection.initializeUnorderedBulkOp();
				// res.rows.map((row) => {
				// 	bulk.find({ url: row.url }).upsert().updateOne({$set: {
				// 		url: row.url,
				// 		name: row.title
				// 	}});
				// });

				// return new Promise((resolve, reject) => {
				// 	bulk.execute((err) => {
				// 		if (err) return reject(err);
				// 		resolve();
				// 	})
				// });
			})
			.then(() => {
				return Progress.update(
					{ type: type, letter: startsWith },
					{ type: type, letter: startsWith, page: page, doneListing: false },
					{ upsert: true }
				);
			})
			.then(() => {return nextUrl});
	},

	findMoreCompanies: function() {
		return Company.find({ profile: null })
			.limit(100)
			.then((companies) => {
				if (companies.length <= 0)
					return true;

				let left = companies.length;
				console.log(`found ${left} companies`);
				return Promise.map(companies, (company) => {
					if (!company.url) return;
					return this.scrapeCompany(company.url)
						.then(function(profile) {
							company.profile = profile;
							company.lastUpdate = new Date();
							return company.save();
						})
						.then(() => {
							left--;
							console.log(`set profile for ${company.name} (${left})`);
						});
				}, {concurrency: 20});
			});
	},

	scrapeCompanies: function() {
		return this.findMoreCompanies()
			.then((shouldStop) => {
				if (shouldStop === true) return;
				return this.scrapeCompanies();
			});
	},

	search: function(companyName) {
		return new Promise((resolve, reject) => {
			Company.collection.find({
				$text: {
					$search: companyName
				}
			}).limit(100).toArray((err, res) => {
				if (err) return reject(err);
				resolve(res);
			});
		});
	},

	callForever: function(func, thisArg, argsArr, timeout) {
		if (typeof timeout === 'undefined') timeout = 1000;

		let funcRec = function() {
			func.apply(thisArg, argsArr) // call the function
				.then(function() {
					// wait a while
					return new Promise(function(resolve) {
						setTimeout(resolve, timeout);
					});
				})
				// then call the same function again
				.then(funcRec)
				// if theres an error, log it and call function again
				.catch((err) => {
					console.error(err.stack);
					return func.apply(thisArg, argsArr);
				});
		};
		return funcRec;
	},

	startProcessing: function() {
		const TIMEOUT = 1000 * 60 * 2;

		Promise.all([
			this.callForever(this.scrapeAll, this, ['private'], TIMEOUT)(),
			this.callForever(this.scrapeAll, this, ['public'], TIMEOUT)(),
			this.callForever(this.scrapeCompanies, this, undefined, TIMEOUT)(),
		]);
	}
};
