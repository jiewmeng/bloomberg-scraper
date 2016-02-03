'use strict'

document.getElementById('frmSearch').addEventListener('submit', function(evt) {
	evt.preventDefault();

	let companyName = document.getElementById('txtCompanyName').value;
	console.log(`search for ${companyName}`);

	superagent.post('/api/search')
		.send({
			search: companyName
		})
		.end(function(err, resp) {
			if (err) return console.error(err);

			let searchResultsContent = document.getElementById('searchResults');
			let htmlRows = resp.body.map(function(row) {
				let htmlRow = '';
				htmlRow += '<tr>';
				htmlRow += '<td class="mdl-data-table__cell--non-numeric"><a href="' + row.url + '" target="_blank">' + row.name + '</a></td>';
				htmlRow += '<td class="mdl-data-table__cell--non-numeric">' + row.profile + '</td>';
				htmlRow += '</tr>';
				return htmlRow;
			}).join('');
			searchResultsContent.innerHTML = '<table class="mdl-data-table mdl-js-data-table"><thead><tr><th class="mdl-data-table__cell--non-numeric">Name</th><th class="mdl-data-table__cell--non-numeric full-width">Profile</th></tr></thead><tbody>' + htmlRows + '</tbody></table>';
		})
});

