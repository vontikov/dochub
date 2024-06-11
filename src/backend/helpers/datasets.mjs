import request from './request.mjs';
import jsonataDriver from '../../global/jsonata/driver.mjs';
import datasetDriver from '../../global/datasets/driver.mjs';
import pathTool from '../../global/manifest/tools/path.mjs';
import entities from '../entities/entities.mjs';
import {isRolesMode, DEFAULT_ROLE} from "../utils/rules.mjs";
import md5 from 'md5';

export default function(app) {

	let currentContext;

	if(isRolesMode()) {
		let currentContext = app.storage.roleId === DEFAULT_ROLE ? app.storage.manifests[DEFAULT_ROLE] : app.storage.manifests[app.storage.roleId];
		entities(currentContext);
	} else {
		currentContext = app.storage.manifest;
	}

	const result = Object.assign({}, datasetDriver,
		{
			// Возвращаем метаданных об объекте
			pathResolver(path) {
				return {
					context: currentContext,
					subject: pathTool.get(currentContext, path),
					baseURI: app.storage.md5Map[md5(path)]
				};
			},
			// Драйвер запросов к ресурсам
			request,
			// Драйвер запросов JSONata
			jsonataDriver
		});
	
	return result;
}
