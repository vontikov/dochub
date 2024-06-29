import YAML from 'yaml';

export default {
    __proto__: require('./base'),
    // Преобразует контент в объект DataLake
    toObject(content) {
        return YAML.parse(response.data);
    },
    // Преобразует объект DataLake в контент
    toContent(object) {
        return YAML.stringify(object);
    }
};
