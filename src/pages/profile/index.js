function Profile() {
	import(/* webpackChunkName: "profile" */ "./profile").then((res) => {
		res.default();
	});
}

export default Profile;
