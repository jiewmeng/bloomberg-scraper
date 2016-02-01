var electron = require('electron');
var ipc = electron.ipcRenderer;

function updateStatus(text) {
	document.getElementById('status').innerText = text;
};

function startScrape() {
	ipc.send('scrape:start');
}


function startScrapeCompanies() {
	ipc.send('scrape:companies');
}

document.getElementById('frmSearch').addEventListener('submit', function(e) {
	console.log('form submit');
	e.preventDefault();
	ipc.send('search', {
		company: document.getElementById('txtCompanyName').value
	});
	return false;
});

ipc.on('searchResults', function(evt, results) {
	console.log(results);
})
