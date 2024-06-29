import xml2js from 'xml2js';

const parser = new xml2js.Parser();
const builder = new xml2js.Builder();

export default {
    __proto__: require('./base'),
    // Преобразует контент в объект DataLake
    toObject(content) {
        let result = null;
		parser.parseString(content, (err, json) => {
			if (err) throw err;
			result = json;
		});
		return result;
    },
    // Преобразует объект DataLake в контент
    toContent(object) {
        return builder.buildObject(object);
    }
};
