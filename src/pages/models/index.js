export default function Models(...args) {
	import(/* webpackChunkName: "models" */ "./models").then((module) => {
		module.default(...args);
	});
}
