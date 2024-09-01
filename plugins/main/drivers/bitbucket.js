import axios from 'axios';
import cookie from 'vue-cookie';
import objectHash from 'object-hash';
import serviceContructor from './service';

// Инициализируем сервис авторизации через dochub.info

const NULL_ORIGIN = 'null://null/';

let currentBranch = null;

// Контроллеры отмены API запросов к Bitbucket
const actualRequest = {};

// API Bitbucket
const api = {
    // Возвращает URL API шлюза
    getAPIServer: () => {
        return driver.authService?.getAPIServer() || driver.config.server || 'https://api.bitbucket.org/2.0/';
    },
    // Возвращает текущий бранч
    currentBranch: () => {
        return currentBranch || driver.config.branch;
    },
    // Переключает бранч
    checkout: async(to) => {
        const affects = [];
        ((currentBranch && (currentBranch !== to) && await api.compare(currentBranch, to))?.diffs || []).map((item) => {
            item.old_path && affects.push(
                new RegExp(item.old_path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            );
        });
        currentBranch = to;
        driver.onChangeStatus();
        DocHub.dataLake.reload(affects.length ? affects : undefined);
    },
    // Сравнивает бранчи и возвращает разницу
    compare: async(from, to) => {
        const result = (await driver.fetch({
            method: 'get',
            url: new URL(`/repos/${driver.config.owner}/${driver.config.repo}/compare/${from}...${to}`, api.getAPIServer())
        })).data;

        return {
            diffs: result.files || []
        };
    },
    getContent: (uri) => driver.request({ url: uri }),
    postContent: (uri, content) => driver.request({ url: uri,  method: 'post', data: content}),
    // Возвращает список проектов
    fetchRepos: async() => {
        return (await driver.fetch({
            method: 'get',
            url: new URL('repositories?role=member', api.getAPIServer())
        })).data?.values?.map((item) => ({
            ...item,
            ref: item.full_name
        })) || [];
    },
    // Возвращает список бранчей
    fetchBranches: async(repo) => {
        return (await driver.fetch({
            method: 'get',
            url: new URL(`repositories/${repo}/refs`, api.getAPIServer())
        })).data?.values || [];
    },
    fetchUser: async() => {
        return (await driver.fetch({
            method: 'get',
            url: new URL('user', api.getAPIServer())
        })).data;
    },
    fetchFiles: async(path, branch, repo) => {
        return ((await driver.fetch({
            method: 'get',
            url: new URL(`repositories/${repo}/src/${branch}/${encodeURIComponent(path)}`, api.getAPIServer())
        })).data?.values || []).map((item) => ({
            ...item,
            name: item.path.split('/').pop(),
            type: {
                'commit_directory': 'dir'
            }[item.type] || 'file'
        }));
    },
    convertURL(url) {
        const urlStr= url.toString();
        if (urlStr.toLowerCase().startsWith('https://github.com/')) {
            const struct = urlStr.split('/');
            const base = `github:${struct[3]}/${(struct[4] || '').split('.')[0]}:`;
            if (struct[5] === 'tree')
                return `${base}${struct[6] || ''}@dochub.yaml`;
            else if (struct[5] === 'blob') {
                return `${base}${struct[6]}@${struct.slice(7).join('/')}`;
            } else {
                return `${base}master@dochub.yaml`;
            }
        } else if (urlStr.toLowerCase().startsWith('git@github.com:')) {
            const segments = urlStr.split(':');
            return `github:${segments[1].split('.')[0]}:master@dochub.yaml`;

        }
        return null;
    }
};

const driver = {
    authService: null,                  // Сервис авторизации
    active: false,                      // Признак активности драйвера
    profile: null,                      // Профиль пользователя
    settings: {},                       // Пользовательские настройки
    config: {
        mode: null,                     // Режим функционирования дрейвера oauth/personal/registry/off
        server: null,                   // Bitbucket сервер
        // OAuth
        appId: null,                    // Идентификатор приложения для режима OAuth
        appSecret: null,                // Секрет приложения для режима OAuth
        accessToken: null,              // Токен доступа режима OAuth
        refreshToken: null,             // Токен обновления токена доступа режима OAuth
        // Personal
        username: null,                 // ID пользователя в bitbucket
        personalToken: null,            // Персональный токен доступа пользователя

        // ...
        owner: null,                    // Владелец репы
        repo: null,                     // Репозиторий 
        branch: null                    // Ветка по умолчанию
    },
    eventsIDs: {
        statusChange: 'bitbucket-status-change',   // Изменился статус
        loginRetry: 'bitbucket-login-retry',       // Пользователь хочет повторить попытку авторизации
        statusGet: 'bitbucket-status-get',         // Кто-то запрашивает текущий статус
        logout: 'bitbucket-logout',                // Нужно завершить сессию
        login: 'bitbucket-login',                  // Нужно авторизоваться
        restart: 'bitbucket-restart'               // Нужно перезапустить драйвер
    },
    // Возвращает true если драйвер готов обрабатывать запросы
    isActive() {
        return this.active;
    },
    login() {
        this.authService.login();
    },
    logout() {
        this.authService.logout();
        this.onChangeStatus();
        DocHub.dataLake.reload();
    },
    getStatus() {
        return {
            api,
            isActive: this.active,
            isLogined: this.config.mode === 'personal' || this.authService?.isLogined(), // Здесь еще oauth нужно реализовать!!!
            avatarURL: driver.profile?.links?.avatar?.href,
            userName: driver.profile?.display_name || driver.profile?.nickname || driver.profile?.username  
        };
    },
    onChangeStatus() {
        const status = this.getStatus();
        if (status.isLogined) {
            api.fetchUser()
                .then((profile) => driver.profile = profile)
                .catch(() => driver.profile = null)
                .finally(() => DocHub.eventBus.$emit(this.eventsIDs.statusChange, this.getStatus()));
        } else {
            DocHub.eventBus.$emit(this.eventsIDs.statusChange, status);
        }
    },
    // Перезапуск драйвера
    restart(context) {
        // Проверяем не запрещено ли использование драйвера перемнными среды
        if((context?.env?.VUE_APP_DOCHUB_BITBUCKET_DISABLE || '').toLowerCase() === 'yes') {
            this.config.mode = 'off';
            // eslint-disable-next-line no-console
            console.warn('Драйвер Bitbucket не активирован т.к. его использование зарещено переменной VUE_APP_DOCHUB_BITBUCKET_DISABLE.');
            return false;
        }
        // Для начала берем настройки из переменных среды
        this.config.server = context.env.VUE_APP_DOCHUB_BITBUCKET_URL;
        this.config.appId = context.env.VUE_APP_DOCHUB_BITBUCKET_APP_ID;
        this.config.appSecret = context.env.VUE_APP_DOCHUB_BITBUCKET_CLIENT_SECRET;
        
        // Если идентификатор приложения указан, счтиаем, что нужно работать в режиме OAuth
        this.config.mode = this.config.appId ? 'oauth' : null;
        // В режиме OAuth работаем по собственному flow
        if (this.config.mode) {
            // Не будем использовать универсальный сервис авторизации DocHub
            this.authService = null;
            // Проверяем, что все параметры интеграции указаны
            if (!this.config.appSecret || !this.config.server) {
                context.emitError(new Error('Драйвер Bitbucket не активирован в режиме "OAuth" т.к. в не задана переменная VUE_APP_DOCHUB_BITBUCKET_CLIENT_SECRET или VUE_APP_DOCHUB_BITBUCKET_URL!'));
                this.config.mode = 'off';
                return false;
            }
            // Получаем сохраненные ранее кредлы
            this.config.accessToken = cookie.get('bitbucket-token-access');
            this.config.refreshToken = cookie.get('bitbucket-token-refresh');
            // eslint-disable-next-line no-console
            console.info('Драйвер Bitbucket активирован в режиме "OAuth".');
            console.warn('!!НО ЕЩЕ НЕДОДЕЛАН!!!');
        } else {
            this.settings = DocHub.settings.pull({
                bitbucketDisable: false,
                bitbucketAuthService: context?.env?.VUE_APP_DOCHUB_BITBUCKET_AUTH_SERVICE,
                bitbucketServer: context.env.VUE_APP_DOCHUB_BITBUCKET_URL,
                bitbucketUsername: context?.env?.VUE_APP_DOCHUB_BITBUCKET_USERNAME,
                bitbucketPersonalToken: context?.env?.VUE_APP_DOCHUB_BITBUCKET_PERSONAL_TOKEN
            });

            // Проверяем не запрещено ли использование драйвера настройками
            if(this.settings.bitbucketDisable) {
                this.config.mode = 'off';
                // eslint-disable-next-line no-console
                console.warn('Драйвер Bitbucket не активирован т.к. его использование зарещено переменной настройками.');
                return false;
            }

            // Если указан универсальный сервис авторизации, то работаем с ним
            if (this.settings.bitbucketAuthService) {
                this.authService = new serviceContructor('bitbucket', (new URL('/bitbucket/oauth/proxy/login', this.settings.bitbucketAuthService)).toString());
                // eslint-disable-next-line no-console
                console.info(`Драйвер Bitbucket активирован в режиме сервиса авторизации [${this.settings.bitbucketAuthService}]`);
                this.config.mode = 'registry';
            } else if (this.settings.bitbucketPersonalToken) { // Если указан персональный токен, то считаем, что работаем в персональном режиме
                this.authService = null;
                // Проверяем, что все параметры интеграции указаны
                if (!this.settings.bitbucketServer || !this.settings.bitbucketPersonalToken || !this.settings.bitbucketUsername) {
                    context.emitError(new Error('Драйвер Bitbucket не активирован в режиме "personal" т.к. в не задана переменная VUE_APP_DOCHUB_BITBUCKET_URL или VUE_APP_DOCHUB_BITBUCKET_USERNAME или VUE_APP_DOCHUB_BITBUCKET_PERSONAL_TOKEN!'));
                    this.config.mode = 'off';
                    return false;
                }
                this.config.mode = 'personal';
                this.config.username = this.settings.bitbucketUsername;
                this.config.personalToken = this.settings.bitbucketPersonalToken;
            } else {
                this.config.mode = 'off';
                return false;
            }
        }
        // Логируем информацию о режиме работы драйвера
        // eslint-disable-next-line no-console
        console.info(`Драйвер Bitbucket активирован в режиме [${this.config.mode}].`);
        return true;
    },
    // Вызывается при инициализации транспортного сервиса
    bootstrap(context) {
        // Отслеживаем события шины
        DocHub.eventBus.$on(this.eventsIDs.loginRetry, () => {
            this.logout();
            this.login();
        });
        // Слушаем запросы о статусе
        DocHub.eventBus.$on(this.eventsIDs.statusGet, () => this.onChangeStatus());
        DocHub.eventBus.$on(this.eventsIDs.logout, () => this.logout());
        DocHub.eventBus.$on(this.eventsIDs.login, () => this.login());
        const restart = () => {
            // Перезапускаем драйвер
            this.active = this.restart(context);
            // Уведомляем всех слушателей шины, что у нас изменилось состояние
            this.onChangeStatus();
        };
        // Отслеживаем запросы на перезапуск драйвера
        window.DocHub.eventBus.$on(this.eventsIDs.restart, restart);
        // Стартуем
        restart();
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
            struct.length === 1 && struct.unshift(undefined);
            return {
                branch: struct[0],
                path: (
                    new URL(struct[1], NULL_ORIGIN)
                ).toString().replace(NULL_ORIGIN, '')
            };
        };

        const applySegment = (segment) => {
            if (!result) {
                result = parseURL(segment);
            } else {
                const offsetURL = parseURL(segment);
                if (offsetURL.branch) {
                    result = offsetURL;
                } else {
                    result.path = (
                        new URL(
                            offsetURL.path,
                            new URL(result.path, NULL_ORIGIN)
                        )
                    ).toString().replace(NULL_ORIGIN, '');
                }
            }
        };
        segments.map((segment) => segment && applySegment(segment));

        result =
            result?.path && (
                (result?.branch ? `${result.branch}@` : '') + result?.path
            ) || undefined;

        return result;
    },
    parseURL(url) {
        const struct = url.toString().split('@');
        const location = struct[0].split(':');
        return {
            repo: location[1] || this.config.defProject,
            branch: location[2] || this.config.defBranch || 'master',
            path: struct[1].split('?')[0].split('#')[0]
        };
    },
    decodeURL(options) {
        // Декодируем URL
        options.originURL = options.url;
        options.decodeURI = this.parseURL(new URL(options.url));
        // Формирум URL запроса
        options.url = new URL(
            `repositories/${options.decodeURI.repo}/src/${options.decodeURI.branch}/${encodeURIComponent(options.decodeURI.path || '')}`
            , api.getAPIServer()
        );
    }, 
    async prepareGET(options) {
        // Декодируем URL
        this.decodeURL(options);
    },
    async preparePUT(options) {
        // commit https://gist.github.com/quilicicf/41e241768ab8eeec1529869777e996f0
        // Декодируем URL
        this.decodeURL(options);
        const path = encodeURIComponent((options.decodeURI.path || '').split('/').slice(0, -1).join('/'));

        const meta = await this.fetch({
            url: new URL(
                `https://api.github.com/repos/${options.decodeURI.owner}/${options.decodeURI.repoId}/git/trees/${options.decodeURI.branch}:${encodeURIComponent(path)}?${Date.now()}`
                , api.getAPIServer()
            )
        });

        const metaFile = meta?.data?.tree.find((item) => options.decodeURI.path.split('/').pop() === item.path);
        const sha = metaFile.sha;

        options.url = new URL(
            `/repos/${options.decodeURI.owner}/${options.decodeURI.repoId}/contents/${encodeURIComponent(options.decodeURI.path || '')}?ref=${options.decodeURI.branch}`
            , api.getAPIServer()
        );
        options.method = 'put';
        const content = btoa(unescape(encodeURIComponent(
            typeof options.data === 'string' ? options.data : JSON.stringify(options.data)
        )));
        options.data = {
            message: 'DocHub automatic commit',
            sha,
            content
        };
    },
    refreshAccessToken() {
        return new Promise((success, reject) => {
            if (this.authService) {
                this.authService.refreshAccessToken()
                    .then(success)
                    .catch(reject);
                return;
            }
            // Здесь прямая работа с Bitbucket
            throw new Error('Прямое взаимодействие с Bitbucket не реализовано!');
        });   
    },    
    fetch(options){
        return new Promise((success, reject) => {
                if (this.config.mode === 'off') {
                    reject(new Error('The Bitbucket driver is desabled.'));
                }
                const doIt = async() => {
                    try {
                        // Если идет процесс авторизации - ждем
                        const authProcessingStatus = this.authService?.getOAuthProcessing();
                        if (authProcessingStatus === 'error')
                            reject(new Error('Bitbucket authorization error!'));
                        else if (authProcessingStatus || this.config.mode === null) {
                            setTimeout(() => doIt(), 100); // Попробуем позже
                            return;
                        }
        
                        // Определяем необходимые заголовки для github
                        options.headers = Object.assign(
                            options.headers || {},
                            {
                                'Accept': 'application/json'
                            }
                        );

                        // Добавляем данные для авторизации
                        switch(this.config.mode) {
                            case 'registry':
                                options.headers['Authorization'] = `Bearer ${await this.authService.getAccessToken()}`;
                                break;
                            case 'personal': 
                                options.auth = {
                                    username: this.config.username,
                                    password: this.config.personalToken
                                };
                                break;
                            default:
                                throw new Error(`Cen not resolve request to ${options.url.toString()} because mode "${this.config.mode}" is undefined for Bibucket driver!`);
                        }

                        // Контролируем дублирующиеся запросы и оптимизируем их
                        let hash;
                        // Следим только за GET, HEAD, OPTIONS
                        if (['get', 'head', 'options'].indexOf((options.method || 'GET').toLowerCase()) >= 0 ) {
                            // Генерируем хез запроса
                            hash = objectHash(options);
                            // Создаем стек актуальных запросов, если его еще нет
                            actualRequest[hash] ||= [];
                            // Добавляем себя в стек
                            actualRequest[hash].push({ success, reject });
                        }
                        // Разпрешам запросы из стека
                        const resolve = (vector, data) => {
                            // Проверяем является ли запрос оптимизируемым
                            if (hash) {
                                // Если да, получаем весь стек запросов
                                const stack = actualRequest[hash] || [];
                                // Успешно разрешаем все запросы в стеке
                                while (stack.length > 0) {
                                    stack.pop()?.[vector](data);
                                }
                                // Удаляем отработанный стек запросов
                                delete actualRequest[hash];
                            } else [vector](data); // Иначе решаем единичный запрос
                        };
                        // Выполняем запрос только если он первый в очереди или неконтролируемый
                        (!hash || actualRequest[hash].length === 1) &&  axios(options)
                            .then((response) => resolve('success', response))
                            .catch((error) => {
                                switch (error.response?.status) {
                                    case 401:
                                    case 403:
                                        // Пытаемся восстановить сессию и повторить запрос
                                        this.refreshAccessToken()
                                            .then(doIt)
                                            // Если ничего не вышло, разрешаем запросы с ошибкой
                                            .catch(() => {
                                                resolve('reject', error);
                                            });
                                        break;
                                    default:
                                        resolve('reject', error);
                                }
                            });
                    } catch (err) {
                        reject(err);
                    }                   
                };
                doIt();
        });
    },
    // Запрос к транспорту
    //  options: axios options
    //      {
    //          method?: string                 - HTTP метод из доступных над ресурсом. По умолчанию GET.
    //          url: string || URL              - Идентификатор ресурса над которым осуществляется действие
    //          content?: string                - Данные для запроса
    //                   || object 
    //                   || uint8array
    //      }
    //  Returns: axios response
    request(options) {
        return new Promise((success, reject) => {
            const origin = new URL(options.url);
            // Если протокол не gitlab сообщаем об ошибке
            if (origin.protocol !== 'bitbucket:') {
                const strError = `Invalid request by Bitbucket driver [${options.url}] `;
                // eslint-disable-next-line no-console
                console.error(strError, options);
                throw new Error(strError);
            }

            // Клонируем объект параметров для работ над ним
            options = Object.assign({}, options);

            const resolver = () => {
                // Выполняем запрос к серверу
                this.fetch(options)
                    .then((response) => {
                        // Предобрабатывавем ответ идентифицируя тип контента по URL
                        const pathname = options.decodeURI.path || '';
                        let contentType = null;
                        if (pathname.endsWith('.json'))
                            contentType = 'application/json';
                        else if (pathname.endsWith('.yaml'))
                            contentType = 'application/x-yaml';
                        else if (pathname.endsWith('.xml'))
                            contentType = 'application/xml';
                        else 
                            contentType = 'text/plain; charset=UTF-8';

                        // Актуализируем информацию о типе контента
                        response.headers = Object.assign(response.headers || {}, {
                            'content-type': contentType || response.headers?.['content-type']
                        });

                        // Вызываем обработчик ответа
                        success(response);
                    })
                    .catch(reject);
            };

            switch (options.method || 'get') {
                case 'get': this.prepareGET(options).then(resolver); break;
                case 'put': this.preparePUT(options).then(resolver); break;
                default:
                    throw new Error(`Unsuppor method [${options.method}] for GitHub driver!`);
            }
           
        });

    }
};

export default driver;
