const THEAD_LIMIT = 3;

// Выполняет валидаторы и накладывает исключения
export default function(datasets, manifest, success, reject) {
	const rules = manifest?.rules || {};
	const validators = rules?.validators || {};
	const exceptions = rules?.exceptions || {};

	let stop = false;
	const context = {
		stop: () => stop = true,
		stack: Object.keys(validators)
	};

	const runValidator = (id) => {
		datasets.getData(manifest, Object.assign({ _id: id }, validators[id]))
			.then((items) => {
				!stop && success({
					id,
					title: validators[id].title || id,
					items: (items || []).map((item) => {
						return Object.assign({
							exception: exceptions[item.uid]
						}, item);
					})
				});
			}).catch((error) => {
				!stop && reject(
					{
						id,
						title: validators[id].title || id,
						error,
						items: [
							{
								uid: id,
								title: 'Критическая ошибка валидатора!',
								correction: 'Исправьте ошибку в запросе валидатора',
								description: error.message
							}
						]
					}
				);
			}).finally(() => {
				const nextId = context.stack.pop();
				if (nextId && !stop) setTimeout(() => runValidator(nextId), 50);
			});
	};

	for (let id, i = 0; (i < THEAD_LIMIT) && (id = context.stack.pop()) && !stop; i++) {
		runValidator(id);
	}

	return context;
}
