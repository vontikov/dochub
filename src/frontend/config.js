import env from '@front/helpers/env';

// eslint-disable-next-line no-console
console.info('ENVIRONMENTS:');

const hiddenEnvs = ['VUE_APP_DOCHUB_CLIENT_SECRET'];

for(const key in env.dochub) {
	// eslint-disable-next-line no-console
	console.info(`  ${key}=`, hiddenEnvs.indexOf(key) < 0 ? JSON.stringify(env.dochub[key]) : '**HIDDEN**');
}

const config = {};

if(!env.gitlabUrl) {
	// eslint-disable-next-line no-console
	console.warn('Not specified the URL of the GitLab (VUE_APP_DOCHUB_GITLAB_URL)');
	config.oauth = false;
} else {
	config.gitlab_server = env.gitlabUrl;

	if (env.personalToken) {
		// Персональный токен генерируемый пользователем
		config.porsonalToken = env.personalToken;
		config.oauth = false;
	} else {
		// Секреты приложения для OAuth авторизации в GitLab
		if(!env.clientSecret)
			throw 'Not specified the application secret at GitLab (VUE_APP_DOCHUB_CLIENT_SECRET)';

		if(!env.appId)
			throw 'Not specified the application ID at GitLab (VUE_APP_DOCHUB_APP_ID)';

		config.oauth = {
			'APP_ID': env.appId,
			'CLIENT_SECRET': env.clientSecret,
			'REQUESTED_SCOPES': 'read_repository+api'
		};
	}
}

export default config;
