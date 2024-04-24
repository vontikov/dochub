const PAPI = {
	isDebug: false,
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-empty-function
	middleware: null,
	settings: {},
	cefQuery: null,
	request(params) {
		const data = JSON.stringify(params);
		// eslint-disable-next-line no-console
		this.isDebug && console.info('plugin request.request', data);
		return new Promise(function(res, rej) {
			const resolve = function(result) {
				// eslint-disable-next-line no-console
				this.isDebug && console.info('plugin request.response:', JSON.stringify(result));
				try {
					const parseData = result || 'null';
					if (window.$PAPI?.middleware)
						res(window.$PAPI.middleware(JSON.parse(parseData)));
					else
						res(JSON.parse(parseData));
				} catch (e) {
					rej(e);
				}
			};
			const reject = function(errCode, errInfo) {
				// eslint-disable-next-line no-console
				console.error('plugin request.error:', errCode, errInfo);
				rej({
					response: {
						data: errInfo,
						headers: {},
						status: errCode
					}
				});
			};
			
			window.$PAPI.cefQuery({
				request: '' + data,
				onSuccess: resolve,
				onFailure: reject
			});
		});
	},
	renderPlantUML(uml) {
		return this.request({ url: 'plugin:/idea/plantuml/svg', source: uml });
	},
	messagePull() {
		return this.request({ url: 'plugin:/idea/gateway/pull' });
	},
	initProject(mode) {
		return this.request({ url: 'plugin:/idea/initproject', mode });
	},
	reload() {
		this.request({ url: 'plugin:/idea/reload' });
	},
	showDebugger() {
		this.request({ url: 'plugin:/idea/debugger/show' });
	},
	goto(source, entity, id) {
		this.request({ url: 'plugin:/idea/goto', source, entity, id });
	},
	download(content, title, description, extension) {
		this.request({ url: 'plugin:/idea/gateway/download', content, title, description, extension });
	},
	applyEntitiesSchema(schema) {
		this.request({ url: 'plugin:/idea/entities/applyschema', schema });
	},
	copyToClipboard(data) {
		this.request({ url: 'plugin:/idea/clipboard/copy', data });
	},
	getSettings() {
		return this.request({ url: 'plugin:/idea/settings/get' });
	}
};

// Ищем окружение плагина

// eslint-disable-next-line no-useless-escape
// const cefQuery = (Object.getOwnPropertyNames(window).filter(item => /^cefQuery\_[0-9]/.test(item)) || [])[0];

const params = new URLSearchParams(document.location.search);
// Пытаемся получить название интерфейсной функции из параметров.
// Если в параметрах ее нет, то берем '%$dochub-api-interface-func%' который
// заботливо должен был подложить плагин заменой.

const fwCefQuery = '%$dochub-api-interface-func%';
let cefQuery = params.get('$dochub-api-interface-func');

// Если в параметрах интерфейсная функция не передана...
if (cefQuery) {
	// eslint-disable-next-line no-console
	console.info('Нашел интерфейсную функцию в параметрах!');
} else if (!cefQuery && window[fwCefQuery]) {
	cefQuery = fwCefQuery;
	// eslint-disable-next-line no-console
	console.info('Нашел интерфейсную функцию в коде!');
} else if (!cefQuery && window.localStorage && localStorage.getItem('cefQuery')) {
	// eslint-disable-next-line no-console
	console.info('Нашел интерфейсную функцию в localStorage!');
	cefQuery = localStorage.getItem('cefQuery');
} else {
	// eslint-disable-next-line no-console
	console.info('Интерфейсную функцию не нашел.');
}

// eslint-disable-next-line no-console
cefQuery && console.info('Plugin API function: ', cefQuery);

if (cefQuery && window[cefQuery]) {
	PAPI.cefQuery = window[cefQuery];
	window.$PAPI = PAPI;
	window.DocHubIDEACodeExt = {
		rootManifest: 'plugin:/idea/source/$root',
		settings: {
			// Тут нужно определиться или признаком Enerprise является запуск под протоколом http/https или настройка в плагине
			isEnterprise: ['http:', 'https:'].indexOf(window.location.protocol) >= 0,
			render: {
				external: false,
				mode: 'ELK',
				server: ''
			}
		}
	};

	PAPI.getSettings().then((config) => {
		const supportAPI = process.env.VUE_APP_DOCHUB_IDE_IDEA_API || [];
		if (supportAPI.indexOf(config.api) < 0) {
			const message = `Данная версия плагина имеет версию API [${config.api}]. Требуются версии: ${supportAPI.join(';')}. Возможно необходимо обновить плагин.`;
			// eslint-disable-next-line no-console
			console.error(message);
			alert(message);
		}
		// Тут нужно определиться или признаком Enerprise является запуск под протоколом http/https или настройка в плагине
		window.DocHubIDEACodeExt.settings = config;
	// eslint-disable-next-line no-console
	}).catch((e) => {
		alert('Не могу получить конфигурацию плагина.');
		// eslint-disable-next-line no-console
		console.error(e);
	});

	// Оставляем след интерфейсной функции для рефрешей и т.п.
	window.localStorage && localStorage.setItem('cefQuery', cefQuery);
} else {
	// eslint-disable-next-line no-console
	console.info('Это не плагин...');
}

export default cefQuery ? PAPI : false;
