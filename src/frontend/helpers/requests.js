import axios from 'axios';
import crc16 from '@global/helpers/crc16';
import uriTool from '@front/helpers/uri';
import { Buffer } from 'buffer';
import env, { Plugins } from './env';

// CRC16 URL задействованных файлов
const tracers = {};

// Add a request interceptor
const responseErrorInterceptor = (error) => {
    if (error.response?.status === 304) {
        if (error.config.lastCachedResult) {
            return {
                ...error.response,
                data: error.config.lastCachedResult.data
            };
        }
    }

    return Promise.reject(error);
};

// Здесь разбираемся, что к нам вернулось из запроса и преобразуем к формату внутренних данных
axios.interceptors.response.use(async(response) => {
    // Выполняем перехват, если он определен
    if (response.config.responseHook)
        response.config.responseHook(response);
    return response;
}, responseErrorInterceptor);


function injectPAPIMiddleware() {
    if (window.$PAPI && !window.$PAPI.middleware) {
        window.$PAPI.middleware = function(response) {
            if (!response) return response;
            let contentType = response.contentType;
            switch (contentType) {
                case 'jpg':
                    contentType = 'jpeg';
                // eslint-disable-next-line no-fallthrough
                case 'jpeg': case 'png': case 'svg':
                    if (contentType === 'svg') contentType = 'svg+xml';
                    response.data = Buffer.from(response.data, 'base64');
                    response.headers = Object.assign(response.headers || {}, {
                        'content-type': `image/${contentType}`
                    });
                    break;
            }
            return response;
        };
    }
}

export default {
    axios,
    getSourceRoot() {
        if (env.isPlugin(Plugins.idea)) {
            return 'plugin:/idea/source/';
        } else {
            return window.origin + '/';
        }
    },

    // Возвращает "чистый" URL пригодный для индексирования
    getIndexURL(url) {
        return url.toString().split('?')[0].split('#')[0];
    },

    // Возвращает CRC ссылки
    crcOfURL(url) {
        return crc16(this.getIndexURL(url));
    },

    // Фиксируются все обращения для построения карты задействованных ресурсов
    trace(url) {
        env.isPlugin() && (tracers[this.crcOfURL(url)] = Date.now());
    },

    // Возвращает время последнего обращения к ресурсу
    isUsedURL(url) {
        return tracers[this.crcOfURL(url)];
    },

    // Транслирует ссылки на backend в прямые URL
    translateBackendURL(url) {
        const finalURl = url && url.toString();
        if (finalURl && finalURl.startsWith('backend://')) {
            try {
                return (new URL(finalURl.slice(10), env.backendFileStorageURL()));
            } catch (e) {
                throw new Error(e);
            }
        } else {
            return url;
        }
    },

    encodeRelPath(path) {
        if (!env.isBackendMode()) return path;
        const struct = path.split('?');
        struct[0] = struct[0].replace(/\.\./g, '%E2%86%90');
        return struct.join('?');
    },

    expandResourceURI(URI) {
        const url = new URL(URI);
        const objectPath = url.pathname.slice(1);
        const subPath = this.encodeRelPath(url.hash.slice(1));
        const result = uriTool.makeURL(uriTool.makeURIByBaseURI(subPath, uriTool.getBaseURIOfPath(objectPath))).url;
        return result.toString();
    },

    // axios_params - параметры передаваемые в axios
    // 		responseHook - содержит функцию обработки ответа перед работой interceptors
    //		raw - если true возвращает ответ без обработки
    request(uri, baseURI, axios_params) {
        const params = Object.assign({}, axios_params);
        params.url = uri;
        let strURI = (uri || '').toString();
        let strBaseURI = (baseURI || '').toString();

        // Если URI является ссылкой на ресурс в Data Lake интерпретируем ее
        strURI.startsWith('res://') && (strURI = this.expandResourceURI(strURI));
        strBaseURI && strBaseURI.startsWith('res://') && (strBaseURI = this.expandResourceURI(strBaseURI));

        // Проверяем должен ли запрос обрабатываться специальным драйвером
        const driver = window.DocHub.protocols.get(
            strURI && ((struct) => struct.length > 1 && struct[0])(strURI.split(':'))
            || baseURI && ((struct) => struct.length > 1 && struct[0])(strBaseURI.split(':'))
            || null
        );

        // Определяем как будем разрешать запрос
        let resolver = null;
        // Если есть драйвер, то он будет этим заниматься сам
        if (driver) {
            params.url = driver.resolveURL(baseURI, uri);
            resolver = driver.request(params);
        } else {
            // Если драйвер не найден, разбираем запрос встроенными методами
            if (strURI.startsWith('source:')) {
                return new Promise((success) => {
                    success({
                        data: JSON.parse(decodeURIComponent((new URL(uri)).pathname))
                    });
                });
            } else if (strURI.startsWith('backend://')) {
                const structURI = strURI.split('/');
                const origin = `${structURI[0]}//${structURI[2]}/`;
                const path = this.encodeRelPath(strURI.slice(origin.length));
                params.url = new URL(path, this.translateBackendURL(origin));
            } else if (strBaseURI.startsWith('backend://')) {
                params.url = new URL(this.encodeRelPath(uri.toString()), this.translateBackendURL(baseURI));
            } else if (baseURI) {
                params.url = uriTool.makeURL(uriTool.makeURIByBaseURI(strURI, baseURI)).url;
            } else {
                params.url = uriTool.makeURL(strURI).url;
            }

            // Если работаем в режиме плагинов, реализуем специальное поведение
            if (
                env.isPlugin(Plugins.idea) && params.url.toString().startsWith('plugin:') ||
                env.isPlugin(Plugins.vscode) && params.url.toString().startsWith('https://file+.vscode-resource.vscode-cdn.net') && !params.responseHook
            ) {
                injectPAPIMiddleware();
                this.trace(params.url);
                params.raw = !!axios_params?.raw;
                resolver = window.$PAPI.request(params);
            } else {
                resolver = axios(params);
            }
        }

        return new Promise((success, reject) => {
            // Если требуется вернуть результат запрос "как есть", не используем обработчики
            resolver.then(axios_params?.raw ? success : (response) => {
                // Обрабатываем полученные данный драйвером, если он определен
                response.data =
                    window.DocHub.contentProviders.get(response.headers?.['content-type'])?.toObject(response.data)
                    || response.data;
                success(response);
            }).catch(reject);
        });
    }
};
