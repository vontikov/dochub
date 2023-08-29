// JSONSchema для данных модели
export default {
    title: 'Параметры передаваемые в URL',
    type: 'object',
    patternProperties: {
        '.*': {
            title: 'Параметр передаваемый в URL',
            type: ['number', 'string']
        }
    },
    additionalProperties: false
};

