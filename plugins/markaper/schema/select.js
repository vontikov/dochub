// JSONSchema для данных модели
export default {
    type: 'array',
    items: {
        title: 'Элемен выбора',
        type: 'object',
        properties: {
            title: {
                title: 'Название элемента',
                type: 'string'
            },
            src: require('./src').default,
            params: require('./urlparams').default,
            selected: {
                title: 'Признак выбора элемента',
                type: 'boolean',
                default: false
            }
        },
        required: ['title', 'src']
    }
};
