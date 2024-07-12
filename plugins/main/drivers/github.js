import axios from "axios";
import cookie from 'vue-cookie';
import OAuthError from '../components/github/OAuthError.vue';

const NULL_ORIGIN = 'null://null/';

let currentBranch = null;

// Контроллеры отмены API запросов к GitlBab
const actualRequest = {};

// Cookies ключи
const cookiesKeys = {
    tokenAccess: 'github-token-access',
    returnRoute: 'github-return-route'
};

const routes = {
    error: {
        name: 'github_error',
        path: '/sso/github/error',
        component: OAuthError
    },
    callback: {
        name: 'github_callback',
        path: '/sso/github/authentication'
    },
    service: {
        name: 'github_auth_service',
        path: null
    }
};

let accessToken = null;    // Токен доступа


const API_SERVER = 'https://api.github.com/';

// API GitLab
const api = {
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
            url: new URL(`/repos/${driver.config.owner}/${driver.config.repo}/compare/${from}...${to}`, API_SERVER)
        })).data;

        return {
            diffs: result.files || []
        };
    },
    // Возвращает список проектов
    fetchRepos: async() => {
        return ((await driver.fetch({
            method: 'get',
            url: new URL(`/user/repos`, API_SERVER)
        })).data || []).map((item) => ({
            ...item,
            ref: item.name
        }));
    },
    // Возвращает список бранчей
    fetchBranches: async(repo, owner) => {
        return (await driver.fetch({
            method: 'get',
            url: new URL(`/repos/${owner || driver.profile.login}/${repo || driver.config.repo}/branches`, API_SERVER)
        })).data;
    },
    fetchUser: async() => {
        return (await driver.fetch({
            method: 'get',
            url: new URL(`/user`, API_SERVER)
        })).data;
    }
};

const driver = {
    active: false,                      // Признак активности драйвера
    profile: null,                      // Профиль пользователя
    isOAuthProcessing: false,           // Признак взаимодействия с сервером авторизации 
    config: {
        isOAuth: true,                  // Признак использования OAuth авторизации
        owner: null,                    // Владелец репы GitHub
        repo: null,                     // Репозиторий 
        branch: null                    // Ветка по умолчанию
    },
    eventsIDs: {
        statusChange: 'github-status-change',
        loginRetry: 'github-login-retry',
        statusGet: 'github-status-get',
        logout: 'github-logout',
        login: 'github-login'
    },
    // Возвращает true если драйвер готов обрабатывать запросы
    isActive() {
        return this.active;
    },
    login() {
        window.location = routes.service.path;
    },
    logout() {
        const status = this.getStatus();
        accessToken = null;
        cookie.delete(cookiesKeys.tokenAccess);
        if (status.isLogined) {
            this.onChangeStatus();
            DocHub.dataLake.reload();
        }
    },
    getStatus() {
        return {
            api,
            isActive: this.active,
            isLogined: !this.isOAuthProcessing && !!accessToken,
            avatarURL: driver.profile?.avatar_url
        };
    },
    onChangeStatus() {
        const status = this.getStatus();
        if (status.isLogined) {
            api.fetchUser()
                .then((profile) => driver.profile = profile)
                .finally(() => DocHub.eventBus.$emit(this.eventsIDs.statusChange, this.getStatus()));
        } else {
            DocHub.eventBus.$emit(this.eventsIDs.statusChange, status);
        }
    },

    refreshAccessToken(weclomeToken) {
        return new Promise((success, reject) => {
            // Если процесс обновления токена уже запущен, ждем результат
            if (this.isOAuthProcessing) {
                const wait = () => {
                    if (!this.isOAuthProcessing) success();
                    else if (this.isOAuthProcessing === 'error') reject(new Error('GitHub authorized error!'));
                    else setTimeout(wait, 100);
                };
                wait();
                return;
            } 
            // Если нет, запускаем процесс обновления токена доступа
            this.isOAuthProcessing = true;
            // Иначе идем в GitLab за токеном доступа
            axios({
                method: 'get',
                url: (new URL('/github/oauth/proxy/access_token', routes.service.path)).toString(),
                params: {
                    token: weclomeToken
                }
            })
                .then((response) => {
                    accessToken = response.data.access_token;
                    // Сохраняем полученный токены для использования после перезагрузки
                    cookie.set(cookiesKeys.tokenAccess, accessToken, 60*60*24*365);
                    this.isOAuthProcessing = false;
                    this.onChangeStatus();
                    success();
                    setTimeout(DocHub.dataLake.reload, 100);
                }).catch((error) => {
                    console.error(error);
                    if (error?.code !== 'ERR_CANCELED') {
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
        // Получаем параметры интеграции
        routes.service.path = context.env.VUE_APP_DOCHUB_GITHUB_AUTH_SERVICE;
        accessToken = cookie.get(cookiesKeys.tokenAccess);

        DocHub.router.registerMiddleware({
            beforeEach: async(to, from, next) => {
                switch (to.name) {
                    case routes.error.name: next(); break;
                    case routes.callback.name: {
                        this.refreshAccessToken(new URL(location.href).searchParams.get('token'))
                            .then(() => next(cookie.get(cookiesKeys.returnRoute) || '/'))
                            .catch(() => next(routes.error.path));
                        break;
                    }
                    default:
                        cookie.set(cookiesKeys.returnRoute, to.fullPath, 1);
                        next();
                }
            }
        });

        // Регистрируем роут для редиректа при авторизации
        window.DocHub.router.registerRoute(routes.callback),
        // Регистрируем роут для отражения ошибки авторизациии
        window.DocHub.router.registerRoute(routes.error);
        // Отслеживаем события шины
        window.DocHub.eventBus.$on(this.eventsIDs.loginRetry, () => {
            this.logout();
            this.login();
        });

        // Устанавливаем флаг активности
        this.active = true;
        // Уведомляем всех слушателей шины, что у нас изменилось состояние
        this.onChangeStatus();
        // Слушаем запросы о статусе
        window.DocHub.eventBus.$on(this.eventsIDs.statusGet, () => this.onChangeStatus());
        window.DocHub.eventBus.$on(this.eventsIDs.logout, () => this.logout());
        window.DocHub.eventBus.$on(this.eventsIDs.login, () => this.login());
        
        // Логируем информацию о режиме работы драйвера
        console.info(`Драйвер GitHub активирован.`);
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
            `/repos/${driver.config.owner}/${segments.space.projectId}/contents/${encodeURIComponent(segments.location)}`
            , API_SERVER
        );
    },

    preparePUT(options) {
        // Декодируем URL
        debugger;
        const segments = this.parseURL(new URL(options.url));
        options.url = new URL(
            `/repos/${driver.config.owner}/${segments.space.projectId}/contents/${encodeURIComponent(segments.location)}`
            , API_SERVER
        );
        options.method = 'put';
        options.data = {
            message: 'DocHub automatic commit',
            content: btoa(options.data)
        };
    },
    fetch(options) {
        return new Promise((success, reject) => {
            const doIt = () => {
                // Если идет процесс авторизации - ждем
                if (this.isOAuthProcessing) {
                    // Если случилась фатальная ошибка, останавливаем запрос
                    if (this.isOAuthProcessing === 'error')
                        reject(new Error('GitHub authorization error!'));
                    else
                        setTimeout(doIt, 100); // Попробуем позже
                    return;
                } else {
                    const strURL = options.url.toString();
                    // Если запрос уже выполняется - убиваем его и формирум новый
                    actualRequest[strURL]?.abort();

                    // Определяем необходимые заголовки для github
                    options.headers = Object.assign(
                        options.headers || {},
                        {
                            'Authorization': `Bearer ${accessToken}`,  // Токен авторизации
                            'Accept': 'application/vnd.github+json',
                            'X-GitHub-Api-Version': '2022-11-28'
                            // 'Access-Control-Allow-Origin': '*'
                        }
                    );

                    const abortControler = actualRequest[strURL] = new AbortController();
                    axios(Object.assign({
                        signal: abortControler.signal
                    }, options)).then(success).catch((error) => {
                        error?.code !== 'ERR_CANCELED' && reject(error);
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
            if (origin.protocol !== 'github:') {
                const strError = `Invalid request by GitHub driver [${options.url}] `;
                console.error(strError, options);
                throw new Error(strError);
            }

            // Клонируем объект параметров для работ ынад ним
            options = JSON.parse(JSON.stringify(options));

            switch (options.method || 'get') {
                case 'get': this.prepareGET(options); break;
                case 'put': this.preparePUT(options); break;
                default:
                    throw new Error(`Unsuppor method [${options.method}] for GitHub driver!`);
            }

            // Выполняем запрос к серверу
            this.fetch(options)
                .then((response) => {
                    // Предобрабатывавем ответ идентифицируя тип контента по URL
                    const pathname = (new URL(response.config.url)).pathname;
                    debugger;
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
