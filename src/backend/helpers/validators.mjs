import validators from '../../global/rules/validators.mjs';
import datasets from './datasets.mjs';
import logger from '../utils/logger.mjs';
import {isRolesMode} from "../utils/rules.mjs";

const LOG_TAG = 'validators';

// Выполняет валидаторы и накладывает исключения
export default function(app) {
	app.storage.problems = app.storage.problems || [];
	const pushValidator = (validator) => {
		app.storage.problems.push(validator);
	};
	logger.log('Executing validators..', LOG_TAG);

	let storageManifest = app.storage.manifest;
	if(isRolesMode()) {
		storageManifest = app.storage.manifests[app.storage.roleId];
	}
	validators(datasets(app), storageManifest, pushValidator, pushValidator);
	logger.log('Done.', LOG_TAG);

}
