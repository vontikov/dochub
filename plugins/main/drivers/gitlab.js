import axios from 'axios';
import cookie from 'vue-cookie';

import serviceContructor from './service';

import OAuthError from '../components/gitlab/OAuthError.vue';

const NULL_ORIGIN = 'null://null/';
const OAUTH_CALLBACK_PAGE = '/sso/gitlab/authentication';
let OAuthCode = null;
const REQUESTED_SCOPES = 'read_repository+api+write_repository';

let currentBranch = null;

// Контроллеры отмены API запросов к GitlBab
const actualRequest = {};

// Cookies ключи
const cookiesKeys = {
    tokenAccess: 'gitlab-token-access',
    tokenRefresh: 'gitlab-token-refresh'
};

// API GitLab
const api = {
    // Возвращает URL API шлюза
    getAPIServer: () => {
        return driver.authService?.getAPIServer() || driver.config.server || 'https://gitlab.com/';
    },
    // Возвращает текущий бранч
    currentBranch: () => {
        return currentBranch || driver.config.defBranch;        
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
            url: new URL(`/api/v4/projects/${driver.config.defProject}/repository/compare?from=${from}&to=${to}&straight=true`, api.getAPIServer())
        })).data;

        return {
            diffs: result.diffs || []
        };
    },
    getContent: (uri) => driver.request({ url: uri }),
    postContent: (uri, content) => driver.request({ url: uri,  method: 'post', data: content}),
    // Возвращает список бранчей
    fetchBranches: async(projectId) => {
        return (await driver.fetch({
            method: 'get',
            url: new URL(`/api/v4/projects/${projectId || driver.config.defProject}/repository/branches`, api.getAPIServer())
        })).data;
    },
    // Возвращает список проектов
    fetchRepos: async(userId) => {
        return ((await driver.fetch({
            method: 'get',
            url: new URL(`/api/v4/users/${userId || driver.profile?.id}/projects`, api.getAPIServer())
        })).data || []).map((item) => ({
            ...item,
            ref: `${item.id}`
        }));
    },
    fetchFiles: async(path, branch, repo) => {
        return ((await driver.fetch({
            method: 'get',
            url: new URL(`/api/v4/projects/${repo || driver.config.defProject}/repository/tree?path=${encodeURIComponent(path || '')}&ref=${branch}`, api.getAPIServer())
        })).data || []).map((item) => {
            return {
                ...item,
                type: item.type === 'tree' ? 'dir' : 'file',
                ref: `${item.id}`
            };
        });
    },
    fetchUser: () => {
        return driver.fetch({
            method: 'get',
            url: new URL('/api/v4/user', api.getAPIServer())
        });        
    }
};

const driver = {
    authService: null,          // Сервис авторизации
    active: false,              // Признак активности драйвера
    profile: null,              // Профиль пользователя
    isOAuthProcessing: false,   // Признак взаимодействия с сервером авторизации 
    config: {
        service: null,          // Сервис авторизации GitLab
        server: null,           // GitLab сервер
        accessToken: null,      // Токен доступа
        refreshToken: null,     // Токен обновления
        appId: null,            // Идентификатор приложения для OAuth авторизации,
        appSecret: null,        // Секрет приложения для OAuth авторизации
        isOAuth: false,         // Признак использования OAuth авторизации
        defProject: 43847396,   // Проект по умолчанию
        defBranch: 'master'     // Ветка по умолчанию
    },
    // Возвращает true если драйвер готов обрабатывать запросы
    isActive() {
        return this.active;
    },
    // Возвращает актуальный адрес сервиса авторизации
    getServiceAddress() {
        return this.config.server ? null : this.config.service || 'https://registry.dochub.info/gitlab/oauth/proxy/login';
    },
    // Проверяет авторизацию, если она не пройдена, отправляет в gitlab
    checkAuth() {
        if (!this.active || this.isOAuthProcessing || !this.config.isOAuth) return;
        if (this.config.refreshToken && !this.config.accessToken) {
            this.refreshAccessToken().catch(this.login);
        }
    },
    login() {
        if(this.authService) this.authService.login();
        else
            window.location = new URL(
                    `/oauth/authorize?client_id=${this.config.appId}`
                    + '&redirect_uri=' + new URL(OAUTH_CALLBACK_PAGE, window.location)
                    + `&response_type=code&state=none&scope=${REQUESTED_SCOPES}`
                    + '&' + Math.floor(Math.random() * 10000)
                    , this.config.server
            );
    },
    logout() {
        if (this.authService) {
            this.authService.logout();
            this.onChangeStatus();
            DocHub.dataLake.reload();
        } else {
            const status = this.getStatus();
            this.config.accessToken = null;
            this.config.refreshToken = null;
            OAuthCode = null;
            cookie.delete(cookiesKeys.tokenAccess);
            cookie.delete(cookiesKeys.tokenRefresh);
            if (status.isLogined) {
                this.onChangeStatus();
                DocHub.dataLake.reload();
            }
        }
    },
    getStatus() {
        return {
            api,
            isActive: this.active,
            isLogined: this.authService ? this.authService.isLogined() : !this.isOAuthProcessing && !!this.config.accessToken,
            avatarURL: driver.profile?.avatar_url
        };
    },
    onChangeStatus() {
        const status = this.getStatus();
        if (status.isLogined) {
            api.fetchUser().then((response) => {
                driver.profile = response.data;
                DocHub.eventBus.$emit('gitlab-status-change', this.getStatus());
            });
        } else {
            DocHub.eventBus.$emit('gitlab-status-change', status);
        }
    },
    refreshAccessToken() {
        return new Promise((success, reject) => {
            if (this.authService) {
                this.authService.refreshAccessToken()
                    .then(success)
                    .catch(reject);
                return;
            }
            // Если процесс обновления токена уже запущен, ждем результат
            if (this.isOAuthProcessing) {
                const wait = () => {
                    if (!this.isOAuthProcessing) success();
                    else if (this.isOAuthProcessing === 'error') reject(new Error('Gitlab authorized error!'));
                    else setTimeout(wait, 100);
                };
                wait();
                return;
            } 
            // Если нет, запускаем процесс обновления токена доступа
            this.isOAuthProcessing = true;

            const params = (() => {
                if (OAuthCode) {
                    return {
                        grant_type: 'authorization_code',
                        code: OAuthCode
                    };
                } else if (this.config.refreshToken) {
                    return {
                        grant_type: 'refresh_token',
                        refresh_token: this.config.refreshToken
                    };
                } else return null;
            })(); 

            // Если невозможно восстановить сессию, т.к. нет кредлов, падаем в ошибку
            if (!params) {
                this.isOAuthProcessing = 'error';
                reject(new Error('No gitlab auth parameters!'));
                this.onChangeStatus();
                return;
            }

            // Иначе идем в GitLab за токеном доступа
            axios({
                method: 'post',
                url: (new URL('/oauth/token', this.config.server)).toString(),
                params: Object.assign({
                    client_id: this.config.appId,
                    redirect_uri: (new URL(OAUTH_CALLBACK_PAGE, window.location)).toString()
                }, params)
            })
                .then((response) => {
                    this.config.accessToken = response.data.access_token;
                    this.config.refreshToken = response.data.refresh_token;

                    // Сохраняем полученные токены для использования после перезагрузки
                    cookie.set('gitlab-token-access', this.config.accessToken, 1 * (response.data.expires_in || 1));
                    cookie.set('gitlab-token-refresh', this.config.refreshToken, 60*60*24*365);
                    this.isOAuthProcessing = false;
                    success();
                    // setTimeout(DocHub.dataLake.reload, 100);
                }).catch((error) => {
                    // eslint-disable-next-line no-console
                    console.error(error);
                    if (error.response?.status === 401) {
                        this.logout();
                        this.isOAuthProcessing = 'error';
                        reject();
                    }
                }).finally(() => this.onChangeStatus());
        });
    },
    // Вызывается при инициализации транспортного сервиса
    //  context: object     - контекст функционирования сервиса
    //      {
    //      }
    bootstrap(context) {
        // Получаем ссылку на универсальный сервис авторизации для gitlab
        const settings = DocHub.settings.pull(['gitlabAuthService']);
        const serviceURL = settings.gitlabAuthService || context?.env?.VUE_APP_DOCHUB_GITLAB_AUTH_SERVICE;

        if (serviceURL) {
            this.authService = new serviceContructor('gitlab', serviceURL);
            // Логируем информацию о режиме работы драйвера
            // eslint-disable-next-line no-console
            console.info(`Драйвер Gitlab активирован в режиме сервиса авторизации [${serviceURL}]`);
        } else {
            // Получаем параметры интеграции
            this.config.server = context.env.VUE_APP_DOCHUB_GITLAB_URL;
            this.config.accessToken = context.env.VUE_APP_DOCHUB_PERSONAL_TOKEN;
            this.config.appId = context.env.VUE_APP_DOCHUB_GITLAB_APP_ID 
                || context.env.VUE_APP_DOCHUB_APP_ID; // Для совместимости со старыми конфигурациями
            this.config.appSecret = context.env.VUE_APP_DOCHUB_GITLAB_CLIENT_SECRET
                || context.env.VUE_APP_DOCHUB_CLIENT_SECRET; // Для совместимости со старыми конфигурациями

            if (!this.config.server) {
                // eslint-disable-next-line no-console
                console.warn('Драйвер Gitlab не активирован т.к. сервер не определен.');
                return;
            }

            // Проверяем на корректность параметров интеграции
            if (!this.config.accessToken && (!this.config.appId || !this.config.appSecret)) {
                context.emitError(new Error('Драйвер Gitlab не активирован т.к. в перематрах интеграции ошибка!'));
                return;
            }

            // Определяем режим функционирования драйвера
            if ((this.config.isOAuth = !!this.config.appId)) {

                this.config.accessToken = cookie.get('gitlab-token-access');
                this.config.refreshToken = cookie.get('gitlab-token-refresh');

                DocHub.router.registerMiddleware({
                    beforeEach: async(to, from, next) => {
                        switch (to.name) {
                            case 'gitlab_error': next(); break;
                            case 'gitlab_callback': {
                                OAuthCode = Object.keys(to.query).length
                                    ? to.query.code
                                    : new URLSearchParams(to.hash.substr(1)).get('code');

                                this.refreshAccessToken()
                                    .then(() => next(cookie.get('gitlab-return-route') || '/'))
                                    .catch(() => next('/sso/gitlab/error'));
                                break;
                            }
                            default:
                                cookie.set('gitlab-return-route', to.fullPath, 1);
                                this.checkAuth();
                                next();
                        }
                    }
                });
                // Регистрируем роут для редиректа при авторизации
                window.DocHub.router.registerRoute(
                    {
                        path: OAUTH_CALLBACK_PAGE,
                        name: 'gitlab_callback'
                    }
                ),

                    // Регистрируем роут для отражения ошибки авторизациии
                    window.DocHub.router.registerRoute(
                        {
                            name: 'gitlab_error',
                            path: '/sso/gitlab/error',
                            component: OAuthError
                        }
                    );
            }

            // Отслеживаем события шины
            window.DocHub.eventBus.$on('gitlab-login-retry', () => {
                this.logout();
                this.login();
            });  
            
            // Логируем информацию о режиме работы драйвера
            // eslint-disable-next-line no-console
            console.info(`Драйвер Gitlab активирован в режиме ${this.config.isOAuth ? '"OAuth"' : '"Personal"'} авторизации.`);
        }

        // Слушаем запросы о статусе
        window.DocHub.eventBus.$on('gitlab-status-get', () => this.onChangeStatus());
        window.DocHub.eventBus.$on('gitlab-logout', () => this.logout());
        window.DocHub.eventBus.$on('gitlab-login', () => this.login());

        // Устанавливаем флаг активности
        this.active = true;
        // Уведомляем всех слушателей шины, что у нас изменилось состояние
        this.onChangeStatus();
        
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
        return ((struct) => ({
            space: ((space) => ({
                projectId: space[0] || this.config.defProject,
                branch: currentBranch || space[1] || this.config.defBranch
            }))(((struct.length > 1 && struct[0]) || '').split(':')),
            location: struct.slice(struct.length > 1 ? 1 : 0).join('@')
        }))(url.pathname.split('@'));
    },
    prepareGET(options) {
        // Декодируем URL
        const segments = this.parseURL(new URL(options.url));
        // Формирум URL запроса
        options.url = new URL(
            `api/v4/projects/${segments.space.projectId}/repository/files/${encodeURIComponent(segments.location)}/raw?ref=${segments.space.branch}`
            , api.getAPIServer()
        );
    },

    preparePUT(options) {
        // Декодируем URL
        const segments = this.parseURL(new URL(options.url));
        options.url = new URL(`/api/v4/projects/${segments.space.projectId}/repository/commits`, api.getAPIServer());
        options.method = 'post';
        options.headers = Object.assign(options.headers, {
            'Content-type': 'application/json; charset=UTF-8'
        });
        options.data = {
            branch: segments.space.branch,
            commit_message: 'DocHub automatic commit',
            actions: [
                {
                    action: 'update',
                    file_path: segments.location,
                    content: options.data
                }
            ]
        };
    },
    fetch(options) {
        return new Promise((success, reject) => {
            const doIt = async() => {
                // Если идет процесс авторизации - ждем
                const oauthProcessing = this.authService?.getOAuthProcessing() || this.isOAuthProcessing;
                if (oauthProcessing === 'error') {
                    // Если случилась фатальная ошибка, останавливаем запрос
                    reject(new Error('GitLab authorization error!'));
                } else if (oauthProcessing) {
                    // Если идет процесс авторизации, попробуем позже
                    setTimeout(doIt, 100); 
                } else {
                    const strURL = options.url.toString();
                    // Если запрос уже выполняется - убиваем его и формирум новый
                    actualRequest[strURL]?.abort();

                    const accessToken = this.config.accessToken || await this.authService?.getAccessToken();

                    // Определяем необходимые заголовки для gitlab
                    options.headers = Object.assign(options.headers || {}, {
                        'Authorization': `Bearer ${accessToken}`  // Токен авторизации
                    });

                    const abortControler = actualRequest[strURL] = new AbortController();
                    axios(Object.assign({
                        signal: abortControler.signal
                    }, options)).then(success).catch((error) => {
                        switch (error.response?.status) {
                            case 401:
                            case 403:
                                this.refreshAccessToken().then(doIt).catch(() => reject(error));
                                break;
                            default:
                                error?.code !== 'ERR_CANCELED' && reject(error);
                        }
                    }).finally(() => delete actualRequest[strURL]);
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
            if (origin.protocol !== 'gitlab:') {
                const strError = `Invalid request by gitlab driver [${options.url}] `;
                // eslint-disable-next-line no-console
                console.error(strError, options);
                throw new Error(strError);
            }

            // Клонируем объект параметров для работ ынад ним
            options = JSON.parse(JSON.stringify(options));

            switch (options.method || 'get') {
                case 'get': this.prepareGET(options); break;
                case 'put': this.preparePUT(options); break;
                default:
                    throw new Error(`Unsuppor method [${options.method}] for Gitlab driver!`);
            }

            // Выполняем запрос к серверу
            this.fetch(options)
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
                    success(response);
                })
                .catch(reject);
        });

    }
};


export default driver;
