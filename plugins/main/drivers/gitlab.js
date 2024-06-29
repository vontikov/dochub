import axios from "axios";

const NULL_ORIGIN = 'null://null/';
export default {
    active: false,           // Признак активности драйвера
    config: {
        server: null,           // GitLab сервер
        token: null,            // Токен доступа
        appId: null,            // Идентификатор приложения для OAuth авторизации,
        isOAuth: false,         // Признак использования OAuth авторизации
        defProject: null,       // Проект по умолчанию
        defBranch: 'master'     // Ветка по умолчанию
    },
    // Возвращает true если драйвер готов обрабатывать запросы
    isActive() {
        return this.active;
    },
    // Вызывается при инициализации транспортного сервиса
    //  context: object     - контекст функционирования сервиса
    //      {
    //      }
    bootstrap(context) {
        // Получаем параметры интеграции
        this.config.server = context.env.VUE_APP_DOCHUB_GITLAB_URL;
        this.config.token = context.env.VUE_APP_DOCHUB_PERSONAL_TOKEN || process.env.VUE_APP_DOCHUB_CLIENT_SECRET;
        this.config.appId = context.env.VUE_APP_DOCHUB_APP_ID;


        if (!this.config.server) {
            console.warn('Драйвер Gitlab не активирован т.к. сервер не определен.');
            return;
        }

        // Проверяем на корректность параметров интеграции
        if (!this.config.token) {
            context.emitError(new Error('Драйвер Gitlab не активирован т.к. токен не определен.'));
            return;
        } else if (context.env.VUE_APP_DOCHUB_CLIENT_SECRET && !this.config.appId) {
            context.emitError(new Error('Драйвер Gitlab не активирован т.к. не задан идентификатор приложения для OAuth авторизации.'));
            return;
        }

        // Определяем режим функционирования драйвера
        this.config.isOAuth = !!this.config.appId;
        // Устанавливаем флаг активности
        this.active = true;
        // Логируем информацию о режиме работы драйвера
        console.info(`Драйвер Gitlab активирован в режиме ${this.config.isOAuth ? '"OAuth"' : '"Personal"'} авторизации.`);
    },
    // Возвращает список методов доступных над URI
    //  uri: string || URL          - Идентификатор ресурса
    //  Returns: Promise: array     - Список доступных HTTP методов для ресурса
    async availableMethodsFor(uri) {
        return uri && ['get'];
    },
    // Разрешает URL
    //  ...segments: strings    - сегменты URL
    //  Results: URL            - URL сформированный на основании переданных параметров
    resolveURL(...segments) {
        let result = null;

        const parseURL = (url) => {
            const struct = url.toString().split('@');
            struct.length === 1 && struct.shift(undefined);
            return { 
                branch: struct[0],
                path: struct[1]
            };
        };

        const applySegment = (segment) => {
            if (!result) {
                result = (new URL(segment, NULL_ORIGIN)).toString();
            } else {
                const offsetURL = parseURL(segment);
                if (offsetURL.branch) {
                    result = offsetURL;
                } else {
                    result.path = new URL(offsetURL.path, new URL(result.path, NULL_ORIGIN));
                }
            }
        };
        segments.map((segment) => applySegment(segment));

        result = ((result?.branch ? `${result.branch}@` : '') + (result?.path?.replace(NULL_ORIGIN, ''))) || null;

        return result;
    },
    // Запрос к транспорту
    //  options: axios options
    //      {
    //          method?: string                 - HTTP метод из доступных над ресурсом. По умолчанию GET.
    //          url: string || URL              - Идентификатор ресурса над которым осуществляется действие
    //          content?: string                - Данные для запроса
    //                   || object 
    //                   || uint8array
    //          responseHook                    - !!!!!!!!!!!!!!! Нафига это? 
    //      }
    //  Returns: axios response
    request(options) {
        return new Promise((seccess, reject) => {
            debugger;
            // Клонируем объект параметров для работ ынад ним
            options = JSON.parse(JSON.stringify(options));
    
            // Декодируем URL
            options.url = ((url) => {
                const origin = new URL(url);
                // Если протокол не gitlab сообщаем об ошибке
                if (origin.protocol !== 'gitlab:') {
                    const strError = `Invalid request by gitlab driver [${url}] `;
                    console.error(strError, options);
                    throw new Error(strError);
                }
                const segments = ((struct) => ({
                    space: ((space) => ({
                        projectId: space[0] || this.config.defProject,
                        branch: space[1] || this.config.defBranch
                    }))(((struct.length > 1 && struct[0]) || '').split(':')),
                    location: struct.slice(struct.length > 1 ? 1 : 0).join('@')
                }))(origin.pathname.split('@'));
    
                return new URL(
                    `api/v4/projects/${segments.space.projectId}/repository/files/${encodeURIComponent(segments.location)}/raw?ref=${segments.space.branch}`
                    , this.config.server
                );
            })(options.url);
    
            // Определяем необходимые заголовки для gitlab
            options.headers = Object.assign(options.headers || {}, {
                'Authorization': `Bearer ${this.config.token}`  // Такен авторизации
            });
    
            // Выполняем запрос к серверу
            axios(options)
                .then((response) => {
                    // Предобрабатывавем ответ идентифицируя тип контента по URL
                    const pathname = (new URL(response.config.url)).pathname;
                    let contentType = null;
                    if (
                        (pathname.indexOf('.json/raw') >= 0)
                        || (pathname.endsWith('.json'))
                    )
                        contentType = 'application/json';
                    else if (
                        (pathname.indexOf('.yaml/raw') >= 0)
                        || (pathname.endsWith('.yaml'))
                    )
                        contentType = 'application/x-yaml';
                    else if (
                        (pathname.indexOf('.xml/raw') >= 0)
                        || (pathname.endsWith('.xml'))
                    )
                        contentType = 'application/xml';

                    // Актуализируем информацию о типе контента
                    response.headers = Object.assign(response.headers || {}, { 
                        'content-type': contentType || response.headers?.['content-type']
                    });

                    // Вызываем обработчик ответа
                    seccess(response);
                })
                .catch(reject);
        });

    }
};
