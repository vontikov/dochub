import validators from '../../global/rules/validators.mjs';
import datasets from './datasets.mjs';
import logger from '../utils/logger.mjs';

const LOG_TAG = 'validators';

// Выполняет валидаторы и накладывает исключения
export default function(app) {
	app.storage.problems = app.storage.problems || [];
	const pushValidator = (validator) => {
		app.storage.problems.push(validator);
	};
	logger.log('Executing validators..', LOG_TAG);
	for (const key in app.storage.manifests) {
		validators(datasets(app), app.storage.manifests[key], pushValidator, pushValidator, key);
	}

	logger.log('Done.', LOG_TAG);

}
