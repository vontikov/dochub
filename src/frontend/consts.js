export default {
	// Идентификаторы куки для хранения данных пользователя
	cookie: {		
		rootManifest: '$root_manifest'		
	},
	plugin: {
		ROOT_MANIFEST: 'plugin:/idea/source/$root'
	},
	pages: {
		MAIN_PAGE: '/main'
	},
	plantuml: {
		DEFAULT_SERVER: 'seaf.slsdev.ru/seafplantuml/svg/' // 'www.plantuml.com/plantuml/svg/'
	},
	transports: {
		HTTP: 'http'
	},
	events: {
		CHANGED_SOURCE: 'on-changed-source'
	}
};

