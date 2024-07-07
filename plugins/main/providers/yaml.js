import YAML from 'yaml';

export default {
    __proto__: require('./base').default,
    // Преобразует контент в объект DataLake
    toObject(content) {
        if (typeof content !== 'string') return content;
        return YAML.parse(content);
    },
    // Преобразует объект DataLake в контент
    toContent(object) {
        if (typeof object === 'string') return object;
        return YAML.stringify(object);
    }
};
