// JSONSchema для выгрузки модели

export default {
    type: 'object',
    patternProperties: {
        '.*': {
            type: ['boolean']
        }
    }
};
