export default function(config) {
	this.axiosInterceptor = async(params) => {
		if (config.bitbucket_server && ((new URL(params.url)).host === (new URL(config.bitbucket_server)).host)) {
			if (!params.headers) params.headers = {};
			// eslint-disable-next-line no-undef
			params.headers['Authorization'] = `Bearer ${config.personalToken || Vuex?.state?.access_token}`;
			params.headers['X-Atlassian-Token'] = 'no-check';
		}
		return params;
	};

	this.makeFileURI = (projectID, repositoryId, source, branch) => {
		const result = new URL(
			`rest/api/1.0/projects/${projectID}/repos/${repositoryId}/raw/`
			+ encodeURIComponent(source).split('%2F').join('/')
			+ `?at=${branch}`
			, config.bitbucket_server);
		return result;
	};
};
