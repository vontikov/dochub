export default {
    __proto__: require('./base'),
    // Преобразует контент в объект DataLake
    toObject(content) {
        return JSON.parse(content);
    },
    // Преобразует объект DataLake в контент
    toContent(object) {
        return JSON.stringify(object);
    }
};
