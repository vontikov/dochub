import parser from 'xml2js';

export default {
	parse(xml) {
		let result = null;
		parser.parseString(xml, (err, json) => {
			if (err) throw err;
			result = json;
		});
		return result;
	}
};
