// JSONSchema для данных модели
export default {
    type: 'array',
    title: 'Элементы дерева',
    items: {
        title: 'Элемент выбора',
        type: 'object',
        properties: {
            location: {
                title: 'Путь к элементу',
                type: 'string'
            },
            link: {
                title: 'Ссылка на объект',
                type: 'string'
            }
        },
        required: ['location']
    }
};
