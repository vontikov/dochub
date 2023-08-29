export function appendParams(src, params) {
    if (params) {
        const hashStruct = src.split('#');
        const paramsStruct = hashStruct[0].split('?');
        const tmpURL = new URL(`https://null?${paramsStruct[1] || ''}${hashStruct[1] ? '#' + hashStruct[1] : ''}`);
        for (const param in params) {
        tmpURL.searchParams.set(param, params[param]);
        }

        return `${paramsStruct[0]}${tmpURL.search}${tmpURL.hash}`;
    } else return src;
}
