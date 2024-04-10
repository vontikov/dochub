import logger from '../utils/logger.mjs';
import manifestParser from '../../global/manifest/parser.mjs';
import cache from './cache.mjs';
import md5 from 'md5';
import events from '../helpers/events.mjs';
import validators from '../helpers/validators.mjs';
import entities from '../entities/entities.mjs';
import objectHash from 'object-hash';
import lodash from 'lodash';
import {systemRules, exclude} from './system-rules.mjs';

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
	reloadManifest: async function(app) {

		console.log('reloadManifest');
		logger.log('Run full reload manifest', LOG_TAG);
		// Загрузку начинаем с виртуального манифеста
		cache.errorClear();
		let localStorage = {};
		let createManifest = async function() {
			await manifestParser.clean();
			await manifestParser.startLoad();
			await manifestParser.import('file:///$root$');
			await manifestParser.checkAwaitedPackages();
			await manifestParser.checkLoaded();
			await manifestParser.stopLoad();
		};

		let matchRegex = (string, filters) => {

			var len = filters.length, i = 0;

			for (; i < len; i++) {
				if (string.match(filters[i])) {
					return true;
				}
			}
			return false;
		};

		let matchExclude = (string) => {
			var len = exclude.length, i = 0;

			for (; i < len; i++) {
				if (string === exclude[i]) {
					return true;
				}
			}
			return false;
		}

		function cleanData(manifest, filters) {
			if (typeof manifest != "object") return;
			if (!manifest) return;

			for (const key in manifest) {
				if(matchExclude(key) || typeof manifest[key] != 'object')
					continue;

				if(matchRegex(key, filters))  {
					cleanData(manifest[key], filters);
				} else {
					delete manifest[key];
				}
			}
		}

		let createRoleManifest = async function () {
			try {
				let uri = `file:///${process.env.VUE_APP_DOCHUB_ROLES}`;
				const response = await cache.request(uri, '/');

				const manifest = response && (typeof response.data === 'object'
					? response.data
					: JSON.parse(response.data));

					for (const key in manifest?.roles) {
						let rawManifest = lodash.cloneDeep(localStorage.manifests.origin);
						cleanData(rawManifest, systemRules.concat(manifest?.roles[key]));
						localStorage.manifests[key] = rawManifest;
					}

			} catch (e) {
				this.registerError(e, e.uri || uri);
			}
		}

		await createManifest();
		localStorage.manifests = {origin: manifestParser.manifest};
		await createRoleManifest();

		console.log('manifestParser.manifest', localStorage.manifests.origin);

		entities(localStorage.manifests['default']); //TODO: уточнить!!!

		logger.log('Full reload is done', LOG_TAG);
		const result = {
			manifest: localStorage.manifests['default'],			// Сформированный манифест
			hash: objectHash(localStorage.manifests['default']),	// HASH состояния для контроля в кластере
			mergeMap: {},								// Карта склейки объектов
			md5Map: {}, 								// Карта путей к ресурсам по md5 пути
			manifests: {...localStorage.manifests},
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

