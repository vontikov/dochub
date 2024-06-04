import logger from '../utils/logger.mjs';
import manifestParser from '../../global/manifest/parser.mjs';
import cache from './cache.mjs';
import md5 from 'md5';
import events from '../helpers/events.mjs';
import validators from '../helpers/validators.mjs';
import entities from '../entities/entities.mjs';
import objectHash from 'object-hash';
import '../helpers/env.mjs';

import jsonataDriver from '../../global/jsonata/driver.mjs';
import jsonataFunctions from '../../global/jsonata/functions.mjs';

const LOG_TAG = 'storage-manager';

manifestParser.cache = cache;

manifestParser.onError = (error) => {
	logger.error(`Error of loading manifest ${error}`, LOG_TAG);
};

// eslint-disable-next-line no-unused-vars
manifestParser.onStartReload = (parser) => {
	logger.log('Manifest start reloading', LOG_TAG);
};

// eslint-disable-next-line no-unused-vars
manifestParser.onReloaded = (parser) => {
	logger.log('Manifest is reloaded', LOG_TAG);
};

export default {
	// Кэш для пользовательских функций
	cacheFunction: null,
	// Регистрация пользовательских функций
	resetCustomFunctions(storage) {
		this.cacheFunction = null;

		jsonataDriver.customFunctions = () => {
			if (!this.cacheFunction)
				this.cacheFunction = jsonataFunctions(jsonataDriver, storage.functions || {});
			return this.cacheFunction;
		};

	},
	// Стек обработчиков события на обновление манифеста
	onApplyManifest: [],
	createNewManifest: async function(app) {
		let matchRegex = (string, filters) => {

			var len = filters.length, i = 0;

			for (; i < len; i++) {
				if (string.match(filters[i])) {
					return true;
				}
			}
			return false;
		};

		let matchExclude = (string, exclude) => {
			var len = exclude.length, i = 0;

			for (; i < len; i++) {
				if (string === exclude[i]) {
					return true;
				}
			}
			return false;
		}

		function cleanData(manifest, filters, exclude) {
			if (typeof manifest != "object") return;
			if (!manifest) return;

			for (const key in manifest) {
				if(matchExclude(key, exclude) || typeof manifest[key] != 'object')
					continue;

				if(matchRegex(key, filters))  {
					cleanData(manifest[key], filters, exclude);
				} else {
					delete manifest[key];
				}
			}
		}

		async function loader(uri) {
			const response = await cache.request(uri, '/');
			return response && (typeof response.data === 'object'
				? response.data
				: JSON.parse(response.data));
		}

		if(app.new_rules) {

			let mergeRules = [];
			const ids = [];

			const {URI} =  global.$roles;
			const url = new URL(URI);
			const defaultUrl = new URL( 'default.yaml', URI);
			const defaultRoles = await loader(defaultUrl);
			const systemRules = defaultRoles?.roles;
			const exclude = defaultRoles?.exclude;

			const manifest = await loader(url);

			for(let rule in app.new_rules) {
				for(let nRule in manifest?.roles) {
					if(app.new_rules[rule] === nRule) {
						mergeRules = mergeRules.concat(manifest?.roles[nRule]);
						ids.push(nRule)
					}
				}
			}

			const id = ids.sort((a,b) => {return a.localeCompare(b);}).join('');
			let rawManifest = JSON.parse(JSON.stringify(app.storage.manifests.origin));
			cleanData(rawManifest, systemRules.concat(mergeRules), exclude);
			app.storage.manifests[id] = rawManifest;
		}
	},
	reloadManifest: async function(app) {

		console.log('reloadManifest');
		logger.log('Run full reload manifest', LOG_TAG);
		// Загрузку начинаем с виртуального манифеста
		cache.errorClear();
		let storageManifest = {};
		let createManifest = async function() {
			await manifestParser.clean();
			await manifestParser.startLoad();
			await manifestParser.import('file:///$root$');
			await manifestParser.checkAwaitedPackages();
			await manifestParser.checkLoaded();
			await manifestParser.stopLoad();
		};

		let matchRegex = (string, filters) => {

			const len = filters.length;

			for (let i = 0; i < len; i++) {
				if (string.match(filters[i])) {
					return true;
				}
			}
			return false;
		};

		let matchExclude = (string, exclude) => {
			const len = exclude.length;

			for (let i = 0; i < len; i++) {
				if (string === exclude[i]) {
					return true;
				}
			}
			return false;
		}

		async function loader(uri) {
			const response = await cache.request(uri, '/');
			return response && (typeof response.data === 'object'
				? response.data
				: JSON.parse(response.data));
		}

		function makeData(manifest, filters, exclude) {
			if (typeof manifest != "object") return;
			if (!manifest) return;

			for (const key in manifest) {
				if(matchExclude(key, exclude) || typeof manifest[key] != 'object')
					continue;

				if(matchRegex(key, filters))  {
					cleanData(manifest[key], filters, exclude);
				} else {
					delete manifest[key];
				}
			}
			return {}
		}

		let createRoleManifest = async function () {
			try {
				// загружаю основной файл с ролями
				const {URI} =  global.$roles;
				const url = new URL(URI);
				const manifest = await loader(url);
				// загружаю правила по умолчанию
				const defaultUrl = new URL('default.yaml', URI);
				const defaultRoles = await loader(defaultUrl);
				const systemRules = defaultRoles?.roles;
				const exclude = defaultRoles?.exclude;





				for (const key in manifest?.roles) {
					const subset = Object.keys(storageManifest.manifests.origin)
						.filter(key => ['baz', 'qux'].indexOf(key) < 0)
						.reduce((obj2, key) => (obj2[key] = obj[key], obj2), {});
					storageManifest.manifests[key] = makeData(storageManifest.manifests.origin, systemRules.concat(manifest?.roles[key]), exclude);
				}
			} catch (e) {
				this.registerError(e, e.uri || uri);
			}
		}

		await createManifest();
		storageManifest.manifests = {origin: manifestParser.manifest};
		Object.freeze(storageManifest.manifests.origin);
		await createRoleManifest();

		console.log('manifestParser.manifest', storageManifest.manifests.origin);

		entities(storageManifest.manifests['default']);

		logger.log('Full reload is done', LOG_TAG);
		const result = {
			manifest: storageManifest.manifests['default'],			// Сформированный манифест
			hash: objectHash(storageManifest.manifests['default']),	// HASH состояния для контроля в кластере
			mergeMap: {},								// Карта склейки объектов
			md5Map: {}, 								// Карта путей к ресурсам по md5 пути
			manifests: {...storageManifest.manifests},
			roleId: 'default',
			// Ошибки, которые возникли при загрузке манифестов
			// по умолчанию заполняем ошибками, которые возникли при загрузке
			problems: Object.keys(cache.errors || {}).map((key) => cache.errors[key]) || []
		};

		// Выводим информацию о текущем hash состояния
		logger.log(`Hash of manifest is ${result.hash}`, LOG_TAG);

		// Если есть ошибки загрузки, то дергаем callback 
		result.problems.length && events.onFoundLoadingError();

		for (const path in manifestParser.mergeMap) {
			result.mergeMap[path] = manifestParser.mergeMap[path].map((url) => {
				const hash = md5(path);
				result.md5Map[hash] = url;
				return `backend://${hash}/`;
			});
		}
		return result;
	},
	applyManifest: async function(app, storage) {
		app.storage = storage;  // Инициализируем данные хранилища
		app.storage.roles = [];
		validators(app);        // Выполняет валидаторы
		Object.freeze(app.storage);
		this.resetCustomFunctions(storage.manifest);
		this.onApplyManifest.map((listener) => listener(app));
		console.log('applyManifest');
	},
	cleanStorage(app) {
		this.cacheFunction = null;
		app.storage = undefined;
	}
};

