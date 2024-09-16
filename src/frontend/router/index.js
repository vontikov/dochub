import Vue from 'vue';
import Router from 'vue-router';

import gateway from '@idea/gateway';
import env from '@front/helpers/env';

import appRoutes from './routes';
import editors from './editors';
import constructors from './constructors';

Vue.use(Router);

const rConfig = {
	scrollBehavior() {
		window.scrollTo(0, 0);
	},
	routes: [
		...appRoutes,
		...editors,
		...constructors
	].map((route) => (
		{
			...route,
			props: (route) => route.params
		}
	))
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

gateway.appendListener('navigate/component', (data) => {
	router.push({ path: `/architect/components/${Object.keys(data)[0]}`});
});

gateway.appendListener('navigate/document', (data) => {
	router.push({ path: `/docs/${Object.keys(data)[0]}`});
});

gateway.appendListener('navigate/aspect', (data) => {
	router.push({ path: `/architect/aspects/${Object.keys(data)[0]}`});
});

gateway.appendListener('navigate/context', (data) => {
	router.push({ path: `/architect/contexts/${Object.keys(data)[0]}`});
});

gateway.appendListener('navigate/devtool', (data) => {
	router.push({ path: `/devtool/${Object.keys(data)[0]}`});
});

export default router;
