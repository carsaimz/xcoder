function open() {
	import(/* webpackChunkName: "timeline" */ "./timeline").then((res) => {
		const Timeline = res.default;
		Timeline();
	});
}

export default open;
