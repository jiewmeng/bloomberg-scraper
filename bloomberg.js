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
		return Promise.promisify(x(url, '#bDesc'))()
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
		return Promise.promisify(x(_getLisingUrl(type, startsWith, page), {
			nextPageUrl: '.paging .nextBtnActive',
			rows: x('#columnLeft table tbody tr', [{
				title: 'td:nth-child(1)',
				url: 'td:nth-child(1) a@href'
			}])
		}))()
			.then((res) => {
				console.log(`>>> Got response for ${type}, Starts with: ${startsWith}, Page: ${page}`);
				nextUrl = res.nextPageUrl;

				let date = new Date();
				let companies = res.rows.map((row) => {
					return {
						name: row.title,
						url: row.url,
						lastUpdate: date
					};
				});

				return new Promise((resolve, reject) => {
					Company.collection.insert(companies, {
						ordered: false
					}, (err) => {
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

				let bulk = Company.collection.initializeUnorderedBulkOp();
				res.rows.map((row) => {
					bulk.find({ url: row.url }).upsert().updateOne({$set: {
						url: row.url,
						name: row.title
					}});
				});

				return new Promise((resolve, reject) => {
					bulk.execute((err) => {
						if (err) return reject(err);
						resolve();
					})
				});
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
		console.log('finding more companies');
		return Company.find({ profile: null })
			.limit(100)
			.then((companies) => {
				if (companies.length <= 0)
					return true;

				let left = companies.length;
				console.log(`found ${left} companies`);
				return Promise.map(companies, (company) => {
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
				}, {concurrency: 6});
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
			}).toArray((err, res) => {
				if (err) return reject(err);
				resolve(res);
			});
		});

	}
};
