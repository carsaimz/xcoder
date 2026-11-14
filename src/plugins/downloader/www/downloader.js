/**
 * window.Downloader — system Android DownloadManager bridge.
 * Native side: src/plugins/downloader/src/android/Downloader.java.
 *
 * download(url, filename)  enqueue with native progress notification → id
 * query(id)                {status, bytes, total, reason, localUri}
 * cancel(id)               remove from the queue
 */
const exec = require('cordova/exec');

module.exports = {
	download: function (url, filename) {
		return new Promise(function (resolve, reject) {
			exec(resolve, reject, 'Downloader', 'download', [url, filename]);
		});
	},
	query: function (id) {
		return new Promise(function (resolve, reject) {
			exec(resolve, reject, 'Downloader', 'query', [String(id)]);
		});
	},
	cancel: function (id) {
		return new Promise(function (resolve, reject) {
			exec(resolve, reject, 'Downloader', 'cancel', [String(id)]);
		});
	},
};
