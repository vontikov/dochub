import axios from 'axios';
import cookie from 'vue-cookie';

import { IGitAPI, IProtocolStatus, ProtocolMode } from './types';
import { IDocHubProtocol, IDocHubProtocolRequestConfig, IDocHubProtocolResponse, IDocHubProtocolMethods, IDocHubContext } from 'dochub-sdk';
import serviceConstructor from './service';

const DocHub: any = window['DocHub'];

const NULL_ORIGIN = 'null://null/';
const OAUTH_CALLBACK_PAGE = '/sso/gitlab/authentication';
const REQUESTED_SCOPES = 'read_repository+api+write_repository';
const OAUTH_CALLBACK_PAGE_NAME = 'auth_service_gitlab_callback';    // ВАЖНО! Для перехвата роута в своем flow название используем идентичное сервису авторизации

let OAuthCode: string | null = null;
let currentBranch: string | null = null;

// Контроллеры отмены API запросов к GitlBab
const actualRequest = {};

// Cookies ключи
enum cookiesKeys {
    tokenAccess = 'gitlab-token-access',
    tokenRefresh = 'gitlab-token-refresh',
    returnRoute = 'gitlab-return-route'
}

// События шины
enum Events {
    statusChange = 'gitlab-status-change',   // Изменился статус
    loginRetry = 'gitlab-login-retry',       // Пользователь хочет повторить попытку авторизации
    statusGet = 'gitlab-status-get',         // Кто-то запрашивает текущий статус
    logout = 'gitlab-logout',                // Нужно завершить сессию
    login = 'gitlab-login',                  // Нужно авторизоваться
    restart = 'gitlab-restart'               // Нужно перезапустить драйвер
}

class GitlabAPI implements IGitAPI {
    // Возвращает URL API шлюза
    getAPIServer() {
        return driver.authService?.getAPIServer() || driver.config.server || 'https://gitlab.com/';
    }
    // Возвращает текущий бранч
    currentBranch(): string | null {
        return currentBranch;
    }
    async checkout(to: string, repo: string): Promise<any> {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const affects: RegExp[] = [];
        if (!currentBranch) throw new Error('Can not switch branch! Not defined current branch.');
        currentBranch && (currentBranch !== to) && ((await this.compare(currentBranch, to, repo))?.diffs || []).map((item: any) => {
            item.old_path && affects.push(
                new RegExp(item.old_path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            );
        });
        currentBranch = to;
        driver.onChangeStatus();
        DocHub.dataLake.reload(affects.length ? affects : undefined);
    }

    // Сравнивает бранчи и возвращает разницу
    async compare(from: string, to: string, repo: string): Promise<any> {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const result: any = (await driver.fetch({
            method: 'get',
            url: (new URL(`/api/v4/projects/${repo}/repository/compare?from=${from}&to=${to}&straight=true`, api.getAPIServer())).toString()
        })).data;

        return {
            diffs: result.diffs || []
        };
    }
    async getContent(uri: string): Promise<any> {
        return driver.request({ url: uri });
    }
    async postContent(uri: string, content: any): Promise<any> {
        return driver.request({ url: uri,  method: 'post', data: content});
    }
    // Возвращает список проектов
    async fetchRepos(): Promise<any> {
        return ((await driver.fetch({
            method: 'get',
            url: new URL(`/api/v4/users/${driver.profile.userId || driver.profile?.id}/projects`, api.getAPIServer())
        })).data || []).map((item) => ({
            ...item,
            ref: `${item.id}`
        }));
    }
    // Возвращает список бранчей
    async fetchBranches(repo: string): Promise<any> {
        return (await driver.fetch({
            method: 'get',
            url: new URL(`/api/v4/projects/${repo}/repository/branches`, api.getAPIServer())
        })).data;
    }
    // Возвращает список файлов
    async fetchFiles(path: string, branch: string, repo: string): Promise<any> {
        return ((await driver.fetch({
            method: 'get',
            url: new URL(`/api/v4/projects/${repo}/repository/tree?path=${encodeURIComponent(path || '')}&ref=${branch}`, api.getAPIServer())
        })).data || []).map((item) => {
            return {
                ...item,
                type: item.type === 'tree' ? 'dir' : 'file',
                ref: `${item.id}`
            };
        });
    }
    // Возвращает профиль пользователя
    async fetchUser(): Promise<any> {
        debugger;
        return driver.fetch({
            method: 'get',
            url: new URL('/api/v4/user', api.getAPIServer())
        });
    }
    // eslint-disable-next-line no-unused-vars
    convertURL(url: string): string | null {
        throw new Error('НЕ РЕАЛИЗОВАНО ДЛЯ GITLAB!');
    }
}

// API GitLab
const api = new GitlabAPI();

interface IConfig {
    mode: ProtocolMode | null;      // Режим функционирования дрейвера oauth/personal/registry/off/null
    server?: string;                // GitLab сервер
    // OAuth
    appId?: string;         // Идентификатор приложения для режима OAuth 
    appSecret?: string;     // Секрет приложения для режима OAuth
    accessToken?: string;   // Токен доступа режима OAuth
    refreshToken?: string;  // Токен обновления токена доступа режима OAuth
    // Personal
    personalToken?:string;  // Персональный токен доступа пользователя
}

class GitLabProtocol implements IDocHubProtocol {
    authService: any = null;                        // Сервис авторизации
    active = false;                                 // Признак активности драйвера
    profile: any = null;                            // Профиль пользователя
    isOAuthProcessing: boolean | 'error' = false;   // Признак взаимодействия с сервером авторизации 
    settings: any = {};                             // Пользовательские настройки
    config: IConfig = {
        mode: null                                  // Режим по умолчанию не определен
    };
    // Возвращает true если драйвер готов обрабатывать запросы
    isActive(): boolean {
        return this.active;
    }
    // Запускает процесс авторизации
    login() {
        switch(this.config.mode) {
            case ProtocolMode.registry:
                this.authService.login();
                break;
            case ProtocolMode.oauth:
                window.location.href = (new URL(
                        `/oauth/authorize?client_id=${this.config.appId}`
                        + '&redirect_uri=' + new URL(OAUTH_CALLBACK_PAGE, window.location.toString())
                        + `&response_type=code&state=none&scope=${REQUESTED_SCOPES}`
                        + '&' + Math.floor(Math.random() * 10000)
                        , this.config.server
                )).toString();
                break;
            case ProtocolMode.personal:
                break;
            default:
                throw new Error(`Unknown login method for mode [${this.config.mode}]`);
        }
    }

    // Завершает сессию
    logout() {
        this.authService?.logout();
        cookie.delete(cookiesKeys.tokenAccess);
        cookie.delete(cookiesKeys.tokenRefresh);
        delete this.config.accessToken;
        delete this.config.refreshToken;
        this.isOAuthProcessing = false;
        OAuthCode = null;
        this.onChangeStatus();
        DocHub.dataLake.reload();
    }

    // Возвращает текущий статус драйвера
    getStatus(): IProtocolStatus {
        return {
            api,
            isActive: this.active,
            isLogined: this.authService ? this.authService.isLogined() : !this.isOAuthProcessing && !!this.config.accessToken,
            avatarURL: this.profile?.avatar_url,
            userName: this.profile?.name
        };
    }

    // Вызывается при обновлении статуса драйвера
    onChangeStatus() {
        const status = this.getStatus();
        if (status.isLogined) {
            api.fetchUser().then((response) => {
                debugger;
                this.profile = response.data;
                DocHub.eventBus.$emit(Events.statusChange, this.getStatus());
            });
        } else {
            DocHub.eventBus.$emit(Events.statusChange, status);
        }
    }

    // Обновляет токены
    refreshAccessToken() {
        return new Promise((success, reject) => {
            // Если процесс обновления токена уже запущен, ждем результат
            if (this.isOAuthProcessing) {
                const wait = () => {
                    if (!this.isOAuthProcessing) success(true);
                    else if (this.isOAuthProcessing === 'error') reject(new Error('Gitlab authorized error!'));
                    else setTimeout(wait, 100);
                };
                wait();
                return;
            } 
            // Иначе запускам процесс
            if (this.config.mode === ProtocolMode.registry) {
                this.authService.refreshAccessToken()
                    .then(success)
                    .catch(reject);
                return;
            } else if (this.config.mode === ProtocolMode.oauth) {
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

                // Иначе указываем, что начали процесс авторизации
                this.isOAuthProcessing = true;
                // Идем в GitLab за токеном доступа
                axios({
                    method: 'post',
                    url: (new URL('/oauth/token', this.config.server)).toString(),
                    params: Object.assign({
                        client_id: this.config.appId,
                        redirect_uri: (new URL(OAUTH_CALLBACK_PAGE, window.location.toString())).toString()
                    }, params)
                })
                    .then((response) => {
                        this.config.accessToken = response.data.access_token;
                        this.config.refreshToken = response.data.refresh_token;

                        // Сохраняем полученные токены для использования после перезагрузки
                        const accessTokenExp = response.data?.expires_in && Math.max(1 * response.data?.expires_in - 300, 0);
                        cookie.set(cookiesKeys.tokenAccess, this.config.accessToken, { expires: accessTokenExp ? `${accessTokenExp}s`: 0 });
                        cookie.set(cookiesKeys.tokenRefresh, this.config.refreshToken, { expires: `${60*60*24*365}s` });
                        this.isOAuthProcessing = false;
                        success(true);
                        // setTimeout(DocHub.dataLake.reload, 100);
                    }).catch((error) => {
                        // eslint-disable-next-line no-console
                        console.error(error);
                        this.logout();
                        this.isOAuthProcessing = 'error';
                        reject(error);
                    }).finally(() => this.onChangeStatus());
            } else if (this.config.mode === ProtocolMode.personal) {
                return;
            } else 
                reject(new Error(`Can not refresh access token in mode ${this.config.mode}`));
        });
    }

    // Вызывается при изменении параметров интеграции
    restart(context) {
        // Проверяем не запрещено ли использование драйвера перемнными среды
        if((context?.env?.VUE_APP_DOCHUB_GITLAB_DISABLE || '').toLowerCase() === 'yes') {
            this.config.mode = ProtocolMode.off;
            // eslint-disable-next-line no-console
            console.warn('Драйвер GitLab не активирован т.к. его использование зарещено переменной VUE_APP_DOCHUB_GITLAB_DISABLE.');
            return false;
        }

        // Для начала проверяем не настроена ли OAuth авторизация для GitLab
        this.config.appId = context.env.VUE_APP_DOCHUB_GITLAB_APP_ID
            || context.env.VUE_APP_DOCHUB_APP_ID; // Для совместимости со старыми конфигурациями
        this.config.appSecret = context.env.VUE_APP_DOCHUB_GITLAB_CLIENT_SECRET
            || context.env.VUE_APP_DOCHUB_CLIENT_SECRET; // Для совместимости со старыми конфигурациями

        // Если идентификатор приложения указан, счтиаем, что нужно работать в режиме OAuth
        this.config.mode = this.config.appId ? ProtocolMode.oauth : null;

        // В режиме OAuth работаем по собственному flow
        if (this.config.mode === ProtocolMode.oauth) {
            this.config.server = context.env.VUE_APP_DOCHUB_GITLAB_URL;
            // Проверяем, что все параметры интеграции указаны
            if (!this.config.appSecret || !this.config.server) {
                context.emitError(new Error('Драйвер Gitlab не активирован в режиме "OAuth" т.к. в не задана переменная VUE_APP_DOCHUB_GITLAB_CLIENT_SECRET или VUE_APP_DOCHUB_GITLAB_URL!'));
                return false;
            }
            // Получаем сохраненные ранее кредлы
            this.config.accessToken = cookie.get(cookiesKeys.tokenAccess) || undefined;
            this.config.refreshToken = cookie.get(cookiesKeys.tokenRefresh) || undefined;
            // eslint-disable-next-line no-console
            console.info('Драйвер Gitlab активирован в режиме "OAuth".');
        } else {
            // Получаем сохраненные пользовательские настройки
            const settings = DocHub.settings.pull(['gitlabAuthService', 'gitlabServer', 'gitlabPersonalToken']);
            // Получаем ссылку на универсальный сервис авторизации для gitlab
            const serviceURL = (new URL('/gitlab/oauth/proxy/login', settings.gitlabAuthService || context?.env?.VUE_APP_DOCHUB_GITLAB_AUTH_SERVICE)).toString();

            // Если сервис авторизации указан, работаем по его flow
            if (serviceURL) {
                this.authService = new serviceConstructor('gitlab', serviceURL);
                // Логируем информацию о режиме работы драйвера
                // eslint-disable-next-line no-console
                console.info(`Драйвер Gitlab активирован в режиме сервиса авторизации [${serviceURL}]`);
            } else {
                // Иначе считаем, что работаем с персональным токеном
                // Получаем параметры интеграции
                this.config.server = settings.gitlabServer || context.env.VUE_APP_DOCHUB_GITLAB_URL;
                this.config.accessToken = settings.gitlabPersonalToken || context.env.VUE_APP_DOCHUB_PERSONAL_TOKEN;

                if (!this.config.server) {
                    // eslint-disable-next-line no-console
                    console.warn('Драйвер Gitlab не активирован в режиме "Personal" т.к. сервер не определен.');
                    return false;
                }
               
                // Логируем информацию о режиме работы драйвера
                // eslint-disable-next-line no-console
                console.info(`Драйвер Gitlab активирован в режиме ${this.config.mode} авторизации.`);
                
            }
        }
        return true;
    }    
    // Вызывается при инициализации
    bootstrap(context: IDocHubContext) {
        //Регистрируем перехватчики переходов для OAuth
        DocHub.router.registerMiddleware({
            beforeEach: async(to, from, next) => {
                // Если мы не в режиме OAuth ничего не делаем
                if (this.config.mode !== ProtocolMode.oauth) {
                    next();
                    return;
                }
                // Иначе обрабатываем роуты
                switch (to.name) {
                    case 'gitlab_error': next(); break;
                    case OAUTH_CALLBACK_PAGE_NAME: {
                        OAuthCode = Object.keys(to.query).length
                            ? to.query.code
                            : new URLSearchParams(to.hash.substr(1)).get('code');

                        this.refreshAccessToken()
                            .then(() => next(cookie.get(cookiesKeys.returnRoute) || '/'))
                            .catch(() => next('/sso/gitlab/error'));
                        break;
                    }
                    default:
                        !to.fullPath.endsWith('/error') && cookie.set(cookiesKeys.returnRoute, to.fullPath, { expires: '300s' });
                        next();
                }
            }
        });
        // Регистрируем роут для редиректа при авторизации
        DocHub.router.registerRoute(
            {
                path: OAUTH_CALLBACK_PAGE,
                name: OAUTH_CALLBACK_PAGE_NAME  
            }
        );
        // Отслеживаем события шины
        DocHub.eventBus.$on(Events.loginRetry, () => {
            this.logout();
            this.login();
        });  
        // Слушаем запросы о статусе
        DocHub.eventBus.$on(Events.statusGet, () => this.onChangeStatus());
        // Отслеживаем задания на сессию
        DocHub.eventBus.$on(Events.logout, () => this.logout());
        DocHub.eventBus.$on(Events.login, () => this.login());
        // Отслеживаем запросы на перезапуск драйвера
        DocHub.eventBus.$on(Events.restart, () => this.active = this.restart(context));
        // Рестартуем дравер 
        this.active = this.restart(context);
        // Уведомляем всех слушателей шины, что у нас изменилось состояние
        this.onChangeStatus();
    }
    // Разрешает URL
    resolveURL(...args: string[]): string {
        let result: any = null;

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
        args.map((segment) => segment && applySegment(segment));

        result =
            result?.path && (
                (result?.branch ? `${result.branch}@` : '') + result?.path
            ) || undefined;

        return result;
    }

    parseURL(url) {
        return ((struct) => ({
            space: ((space) => ({
                projectId: space[0],
                branch: currentBranch || space[1]
            }))(((struct.length > 1 && struct[0]) || '').split(':')),
            location: struct.slice(struct.length > 1 ? 1 : 0).join('@')
        }))(url.pathname.split('@'));
    }

    // Подготавливает запрос к GET
    prepareGET(options) {
        // Декодируем URL
        const segments = this.parseURL(new URL(options.url));
        // Формирум URL запроса
        options.url = new URL(
            `api/v4/projects/${segments.space.projectId}/repository/files/${encodeURIComponent(segments.location)}/raw?ref=${segments.space.branch}`
            , api.getAPIServer()
        );
    }

    // Подготавливает запрос к PUT
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
    }

    fetch(options: any): Promise<any>{
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
    }
    // Запрос к транспорту
    request(config: IDocHubProtocolRequestConfig): Promise<IDocHubProtocolResponse> {
        return new Promise((success, reject) => {
            if (!config.url) throw new Error('Not defined url property in request config of GitLab request.');

            const origin = new URL(config.url);
            // Если протокол не gitlab сообщаем об ошибке
            if (origin.protocol !== 'gitlab:') {
                const strError = `Invalid request by gitlab driver [${config.url}] `;
                // eslint-disable-next-line no-console
                console.error(strError, config);
                throw new Error(strError);
            }

            // Клонируем объект параметров для работ ынад ним
            config = JSON.parse(JSON.stringify(config));

            switch (config.method || 'get') {
                case 'get': this.prepareGET(config); break;
                case 'put': this.preparePUT(config); break;
                default:
                    throw new Error(`Unsuppor method [${config.method}] for Gitlab driver!`);
            }

            // Выполняем запрос к серверу
            this.fetch(config)
                .then((response: any) => {
                    // Предобрабатывавем ответ идентифицируя тип контента по URL
                    const pathname = (new URL(response.config.url)).pathname;
                    let contentType: string | null  = null;
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
    // Возвращает список методов доступных над URI
    async availableMethodsFor(uri: string): Promise<IDocHubProtocolMethods[]> {
        return uri ? [IDocHubProtocolMethods.GET] : [];
    }
    
}

const driver = new GitLabProtocol();

export default driver;
