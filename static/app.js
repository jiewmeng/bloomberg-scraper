'use strict'

document.getElementById('frmSearch').addEventListener('submit', function(evt) {
	evt.preventDefault();

	let companyName = document.getElementById('txtCompanyName').value;
	console.log(`search for ${companyName}`);

	return false;
});
