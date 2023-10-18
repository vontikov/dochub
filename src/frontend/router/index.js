import Vue from 'vue';
import Router from 'vue-router';
import cookie from 'vue-cookie';

import env from '@front/helpers/env';

import appRoutes from './routes';

Vue.use(Router);

const rConfig = {
	scrollBehavior() {
		window.scrollTo(0, 0);
	},
	routes: [
		...appRoutes
	]
};

if (!env.isPlugin()) {
	rConfig.mode = 'history';
	rConfig.routes.push(
		{
			path: '/',
			redirect() {
				window.location = new URL('/main', window.origin);
			}
		});
	rConfig.routes.push(
		{
			path: '/sso/gitlab/authentication',
			redirect(route) {
				const OAuthCode = Object.keys(route.query).length
					? route.query.code
					: new URLSearchParams(route.hash.substr(1)).get('code');
				if (OAuthCode) {
					window.Vuex.dispatch('onReceivedOAuthCode', OAuthCode);
					const rRoute = cookie.get('return-route');
					return rRoute ? JSON.parse(rRoute) : {
						path: '/main',
						query: {},
						hash: ''
					};
				} else {
					return {
						path: '/sso/error',
						query: {},
						hash: ''
					};
				}
			}
		}
	);
} else {
	rConfig.routes.push(
		{
			path: '/url=about:blank',
			redirect() {
				window.location = new URL('/url=main', window.location);
			}
		}
	);
}

const router = new Router(rConfig);

export default router;
