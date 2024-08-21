import axios from 'axios';
import serviceContructor from './service';

// Инициализируем сервис авторизации через dochub.info
// для GitHub он является единственным средством получения токена доступа

const NULL_ORIGIN = 'null://null/';

let currentBranch = null;

// Контроллеры отмены API запросов к GitlHub
const actualRequest = {};

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
    getContent: (uri) => driver.request({ url: uri }),
    postContent: (uri, content) => driver.request({ url: uri,  method: 'post', data: content}),
    // Возвращает список проектов
    fetchRepos: async() => {
        return ((await driver.fetch({
            method: 'get',
            url: new URL('/user/repos', API_SERVER)
        })).data || []).map((item) => ({
            ...item,
            ref: item.full_name
        }));
    },
    // Возвращает список бранчей
    fetchBranches: async(repo, owner) => {
        const repoId = (repo || '').split('/').pop();
        return (await driver.fetch({
            method: 'get',
            url: new URL(`/repos/${owner || driver.profile.login}/${repoId || driver.config.repo}/branches`, API_SERVER)
        })).data;
    },
    fetchUser: async() => {
        return (await driver.fetch({
            method: 'get',
            url: new URL('/user', API_SERVER)
        })).data;
    },
    fetchFiles: async(path, branch, repo, owner) => {
        const repoId = (repo || '').split('/').pop();
        return (await driver.fetch({
            method: 'get',
            url: new URL(`/repos/${owner || driver.profile.login}/${repoId || driver.config.repo}/contents/${encodeURIComponent(path || '')}?ref=${branch || 'master'}`, API_SERVER)
        })).data;
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
        owner: null,                    // Владелец репы GitHub
        repo: null,                     // Репозиторий 
        branch: null                    // Ветка по умолчанию
    },
    eventsIDs: {
        statusChange: 'github-status-change',   // Изменился статус
        loginRetry: 'github-login-retry',       // Пользователь хочет повторить попытку авторизации
        statusGet: 'github-status-get',         // Кто-то запрашивает текущий статус
        logout: 'github-logout',                // Нужно завершить сессию
        login: 'github-login'                   // Нужно авторизоваться
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
            isLogined: this.authService.isLogined(),
            avatarURL: driver.profile?.avatar_url,
            userName: driver.profile?.name
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
    
    // Вызывается при инициализации транспортного сервиса
    bootstrap(context) {
        // Получаем ссылку на универсальный сервис авторизации для github
        const settings = DocHub.settings.pull(['githubAuthService']);
        this.authService = new serviceContructor('github', 
            settings.githubAuthService || context?.env?.VUE_APP_DOCHUB_GITHUB_AUTH_SERVICE
        );
        // Отслеживаем события шины
        DocHub.eventBus.$on(this.eventsIDs.loginRetry, () => {
            this.logout();
            this.login();
        });
        // Слушаем запросы о статусе
        DocHub.eventBus.$on(this.eventsIDs.statusGet, () => this.onChangeStatus());
        DocHub.eventBus.$on(this.eventsIDs.logout, () => this.logout());
        DocHub.eventBus.$on(this.eventsIDs.login, () => this.login());
        // Устанавливаем флаг активности
        this.active = true;
        // Уведомляем всех слушателей шины, что у нас изменилось состояние
        this.onChangeStatus();
        // Логируем информацию о режиме работы драйвера
        // eslint-disable-next-line no-console
        console.info('Драйвер GitHub активирован.');
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
        const repo = location[1].split('/');
        return {
            owner: repo.length > 1 ? repo[0] : driver.config.owner || driver.profile.login,
            repoId: repo[1] || repo[0] || this.config.defProject,
            branch: location[2] || this.config.defBranch || 'master',
            path: struct[1].split('?')[0].split('#')[0]
        };
    },
    async prepareGET(options) {
        // Декодируем URL
        const segments = this.parseURL(new URL(options.url));
        // Формирум URL запроса
        options.url = new URL(
            `/repos/${segments.owner}/${segments.repoId}/contents/${encodeURIComponent(segments.path || '')}?ref=${segments.branch}`
            , API_SERVER
        );
    },

    async preparePUT(options) {
        // commit https://gist.github.com/quilicicf/41e241768ab8eeec1529869777e996f0
        // Декодируем URL
        const segments = this.parseURL(new URL(options.url));
        const path = encodeURIComponent((segments.path || '').split('/').slice(0, -1).join('/'));

        const meta = await this.fetch({
            url: new URL(
                `https://api.github.com/repos/${segments.owner}/${segments.repoId}/git/trees/${segments.branch}:${encodeURIComponent(path)}?${Date.now()}`
                , API_SERVER
            )
        });

        const metaFile = meta?.data?.tree.find((item) => segments.path.split('/').pop() === item.path);
        const sha = metaFile.sha;

        options.url = new URL(
            `/repos/${segments.owner}/${segments.repoId}/contents/${encodeURIComponent(segments.path || '')}?ref=${segments.branch}`
            , API_SERVER
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
    fetch(options) {
        return new Promise((success, reject) => {
            const doIt = async() => {
                // Если идет процесс авторизации - ждем
                const authProcessingStatus = this.authService?.getOAuthProcessing();
                if (authProcessingStatus === 'error')
                    reject(new Error('GitHub authorization error!'));
                else if (authProcessingStatus || !this.authService) {
                    setTimeout(() => doIt(), 100); // Попробуем позже
                    return;
                }

                const strURL = options.url.toString();
                // Если запрос уже выполняется - убиваем его и формирум новый
                actualRequest[strURL]?.abort();

                // Определяем необходимые заголовки для github
                options.headers = Object.assign(
                    options.headers || {},
                    {
                        'Authorization': `Bearer ${await this.authService.getAccessToken()}`,  // Токен авторизации
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                );

                const abortControler = actualRequest[strURL] = new AbortController();
                axios(Object.assign({
                    signal: abortControler.signal
                }, options)).then(success).catch((error) => {
                    error?.code !== 'ERR_CANCELED' && reject(error);
                }).finally(() => delete actualRequest[strURL]);
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
                        const pathname = response.data.path || '';
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

                        if (response.data?.encoding === 'base64') {
                            response.data = decodeURIComponent(atob(response.data.content).split('').map(function(c) {
                                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                            }).join(''));
                        } else 
                            response.data = response.data.content;

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
