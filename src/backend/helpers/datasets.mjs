import request from './request.mjs';
import jsonataDriver from '../../global/jsonata/driver.mjs';
import datasetDriver from '../../global/datasets/driver.mjs';
import pathTool from '../../global/manifest/tools/path.mjs';
import entities from '../entities/entities.mjs';
import md5 from 'md5';

export default function(app) {
	let ctx = app.storage.roles.length == 0 ? app.storage.manifests['default'] : app.storage.manifests[app.storage.roles[0]];
	entities(ctx);
	const result = Object.assign({}, datasetDriver,
		{
			// Возвращаем метаданных об объекте
			pathResolver(path) {
				return {
					context: ctx,
					subject: pathTool.get(ctx, path),
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
