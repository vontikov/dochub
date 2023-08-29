// JSONSchema для данных модели

const PATTERN_UNITS = '^[0-9|\\.]*(%|px|vw|vh|vmin|vmax|em|rem)$';

export default {
    anyOf: [
        {
            type: 'object',
            properties: {
                type: {
                    title: 'Тип секции',
                    type: 'string',
                    enum: ['columns']
                },
                items: {
                    title: 'Элементы разметки',
                    type: 'array',
                    items: {
                        $ref: '#/'
                    }
                }
            },
            required: ['type', 'items']
        },
        {
            type: 'object',
            properties: {
                type: {
                    title: 'Тип секции',
                    type: 'string',
                    enum: ['rows']
                },
                items: {
                    title: 'Элементы разметки',
                    type: 'array',
                    items: {
                        $ref: '#/'
                    }
                }
            },
            required: ['type', 'items']
        },
        {
            type: 'object',
            properties: {
                title: {
                    title: 'Заголовок секции',
                    type: 'string'
                },
                icon: {
                    title: 'Иконка',
                    type: 'string'
                },
                border: {
                    title: 'Рамка',
                    type: 'boolean'
                },
                style: {
                    type: 'object',
                    properties: {
                        padding: {
                            title: 'Внутренний отступ',
                            pattern: PATTERN_UNITS
                        },
                        'min-height': {
                            title: 'Минимальная высота',
                            pattern: PATTERN_UNITS
                        },
                        'min-width': {
                            title: 'Минимальная ширина',
                            pattern: PATTERN_UNITS
                        },
                        'max-height': {
                            title: 'Максимальная высота',
                            pattern: PATTERN_UNITS
                        },
                        'max-width': {
                            title: 'Максимальная ширина',
                            pattern: PATTERN_UNITS
                        },
                        'border': {
                            title: 'Рамка',
                            type: 'boolean'
                        }
                    },
                    additionalProperties: false
                },
                height: {
                    title: 'Высота секции',
                    pattern: PATTERN_UNITS
                },
                width: {
                    title: 'Ширина секции',
                    pattern: PATTERN_UNITS
                },
                src: require('./src').default,
                params: require('./urlparams').default
            }
        }
    ]
};
