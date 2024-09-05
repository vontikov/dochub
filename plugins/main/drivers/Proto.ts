import cookie from 'vue-cookie';
import serviceConstructor from './service';

import { 
    IGitAPI,
    IProtocolStatus, 
    IProtocolUserProfile} from './types';
import { 
    IDocHubProtocol,
    IDocHubProtocolRequestConfig,
    IDocHubProtocolResponse,
    IDocHubProtocolMethods,
    IDocHubContext } from 'dochub-sdk';
import axios from 'axios';
import objectHash from 'object-hash';

export interface IProtocolParams {
    server?: string;        // URL сервер
    authService?: string;   // URL сервиса авторизации
    // OAuth
    appId?: string;         // Идентификатор приложения для режима OAuth 
    appSecret?: string;     // Секрет приложения для режима OAuth
    accessToken?: string;   // Токен доступа режима OAuth
    refreshToken?: string;  // Токен обновления токена доступа режима OAuth
    // Personal
    username?: string;      // ID пользователя
    personalToken?:string;  // Персональный токен доступа пользователя
}

export enum ProtocolMode {
    disable = 'disable',
    registry = 'registry',
    personal = 'personal_token',
    oauth = 'oauth'
}

export interface IProtocolConfig extends IProtocolParams {
    mode: ProtocolMode | null;      // Режим функционирования драйвера oauth/personal/registry/off/null
}

export interface IProtocolEnvironments extends IProtocolParams {
    isDisable: boolean;     // Признак отключения драйвера
}

export interface IProtocolSettings {
    mode: ProtocolMode;             // Режим функционирования драйвера
    server?: string;                // API сервер
    authService?: string;           // URL сервиса авторизации
    username?: string;              // ID пользователя
    personalToken?:string;          // Персональный токен доступа пользователя
}

export interface IDecodedURI {
    repo: string;
    branch: string;
    path: string;
}

export interface IProtocolRequestConfig extends IDocHubProtocolRequestConfig {
    decodeURI: IDecodedURI;
    originURL: string | undefined;
}

export interface IMainProtocolStatus extends IProtocolStatus  {
    mode: ProtocolMode;
}

export class ProtoProtocol implements IDocHubProtocol {
    DocHub: any = window['DocHub'];                 // Объект ядра DocHub
    OAuthCode: string | null = null;                // Код выданный процессом OAuth авторизации
    isOAuthProcessing: boolean | 'error' = false;   // Признак взаимодействия с сервером авторизации в собственной OAuth flow
    authService: any = null;                        // Сервис авторизации
    active = false;                                 // Признак активности драйвера
    profile: any = null;                            // Профиль пользователя
    actualRequest = {};                             // Стек актуальных запросов
    settings: IProtocolSettings = {
        mode: ProtocolMode.disable
    };                             
    config: IProtocolConfig = {
        mode: null                                  // Режим функционирования изначально не определен
    };

    // События, которы отрабатывает драйвер
    Events: any = {
        statusChange: `${this.getAlias()}-status-change`,     // Изменился статус
        loginRetry: `${this.getAlias()}-login-retry`,         // Пользователь хочет повторить попытку авторизации
        statusGet: `${this.getAlias()}-status-get`,           // Кто-то запрашивает текущий статус
        logout: `${this.getAlias()}-logout`,                  // Нужно завершить сессию
        login: `${this.getAlias()}-login`,                    // Нужно авторизоваться
        restart: `${this.getAlias()}-restart`                 // Нужно перезапустить драйвер
    };

    // Ключи для куки
    cookiesKeys: any = {
        tokenAccess: `auth-${this.getAlias()}-token-access`,
        tokenRefresh: `auth-${this.getAlias()}-token-refresh`,
        returnRoute: 'auth-return-route'
    };
    
    // Возвращает псевдоним драйвера для идентификации его сообщений
    getAlias(): string {
        return this.constructor.name;
    }

    // Возвращает true если драйвер готов обрабатывать запросы
    isActive(): boolean {
        return this.active;
    }

    // Выполняет действия по авторизации в зависимости от режима
    login() {
        // Если процесс авторизации уже идет, ничего не делаем
        if(this.isOAuthProcessing === true) return;
        // Иначе сбрасываем результат прошлой авторизации
        this.isOAuthProcessing = false;
        // Анализируем режим
        switch(this.config.mode) {
            // Реализуем все методы авторизации кроме OAuth
            case ProtocolMode.registry:
                this.authService.login();
                break;
            case ProtocolMode.oauth:
                // Здесь вызываем метод создания OAuth URL
                window.location.href = this.makeOAuthLoginURL();
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
        cookie.delete(this.cookiesKeys.tokenAccess);
        cookie.delete(this.cookiesKeys.tokenRefresh);
        delete this.config.accessToken;
        delete this.config.refreshToken;
        this.isOAuthProcessing = false;
        this.OAuthCode = null;
        this.onChangeStatus();
        this.DocHub.dataLake.reload();
    }

    // Должен возвращать true если пользователь не может менять конфигурацию
    isFixedSettings() {
            return true;
    }

    // Возвращает профиль пользователя
    getPublicUserProfile(data: any): IProtocolUserProfile {
        return {
            avatarURL: data.avatar?.href,
            userName: data.display_name || data.nickname || data.username
        };
    }

    // Возвращает текущий статус драйвера протокола
    getStatus(): IMainProtocolStatus {
        const publicProfile = this.getPublicUserProfile(this.profile);
        return {
            mode: this.config.mode || ProtocolMode.disable,
            api: this.getApi(),
            isActive: this.active,
            isLogined: this.config.mode === ProtocolMode.personal || !!this.config.accessToken || this.authService?.isLogined(),
            avatarURL: publicProfile.avatarURL,
            userName: publicProfile.userName 
        };
    }

    // Обработчик события изменения статуса драйвера
    onChangeStatus() {
        const status = this.getStatus();
        if (status.isLogined) {
            this.getApi().fetchUser()
                .then((profile) => this.profile = profile)
                .catch(() => this.profile = null)
                .finally(() => this.DocHub.eventBus.$emit(this.Events.statusChange, this.getStatus()));
        } else {
            this.DocHub.eventBus.$emit(this.Events.statusChange, status);
        }
    }

    // Перезапуск драйвера
    restart(context) {
        const env = this.getEnv(context);
        // Проверяем не запрещено ли использование драйвера переменными среды
        if(env.isDisable) {
            this.config.mode = ProtocolMode.disable;
            // eslint-disable-next-line no-console
            console.warn(`Драйвер ${this.getAlias()} не активирован т.к. его использование запрещено конфигурацией среды. Обратитесь к администратору.`);
            return false;
        }
        // Для начала берем настройки из переменных среды
        this.config.server = env.server;
        this.config.appId = env.appId;
        this.config.appSecret = env.appSecret;
        // Если идентификатор приложения указан, считаем, что нужно работать в режиме OAuth
        this.config.mode = this.config.appId ? ProtocolMode.oauth : null;
        // В режиме OAuth работаем по собственному flow
        if (this.config.mode === ProtocolMode.oauth) {
            // Не будем использовать универсальный сервис авторизации DocHub
            this.authService = null;
            // Проверяем, что все параметры интеграции указаны
            if (!this.config.appSecret || !this.config.server) {
                context.emitError(new Error(`Драйвер ${this.getAlias()} не активирован в режиме "OAuth" т.к. не определена или определена неверно конфигурация интеграции! Обратитесь к администратору.`));
                this.config.mode = ProtocolMode.disable;
                return false;
            }
            // Получаем сохраненные ранее кредлы, если они есть
            this.config.accessToken = cookie.get(this.cookiesKeys.tokenAccess) || undefined;
            this.config.refreshToken = cookie.get(this.cookiesKeys.tokenRefresh) || undefined;
        } else {
            // Получаем пользовательские настройки
            this.settings = this.getSettings(context);
            // Проверяем не запрещено ли использование драйвера настройками
            if(this.settings.mode === ProtocolMode.disable) {
                this.config.mode = ProtocolMode.disable;
                // eslint-disable-next-line no-console
                console.warn(`Драйвер ${this.getAlias()} не активирован т.к. его использование запрещено пользовательскими настройками.`);
                return false;
            }

            // Если указан универсальный сервис авторизации, то работаем с ним
            if (this.settings.mode === ProtocolMode.registry) {
                // Пересоздам сервис авторизации если его не было до этого
                this.authService ||= new serviceConstructor(this.getAlias(), context.env.DEV_AUTH_SERVICE /* Для разработки можно поменять адрес сервиса авторизации */);
                // eslint-disable-next-line no-console
                this.config.mode = ProtocolMode.registry;
            } else if (this.settings.mode === ProtocolMode.personal) { // Если указан персональный токен, то считаем, что работаем в персональном режиме
                this.authService = null;
                this.config.mode = ProtocolMode.personal;
                this.config.username = this.settings.username;
                this.config.personalToken = this.settings.personalToken;
            } else {
                this.config.mode = ProtocolMode.disable;
                return false;
            }
        }
        // Логируем информацию о режиме работы драйвера
        // eslint-disable-next-line no-console
        console.info(`Драйвер ${this.getAlias()} активирован в режиме [${this.config.mode}].`);
        return true;
    }

    // Возвращает идентификатор callback страницы в роутах 
    getOAuthCallbackPageName(): string {
        return `auth_service_${this.getAlias()}_callback`; // ВАЖНО! Для перехвата роута в своем flow название используем идентичное сервису авторизации
    }

    // Возвращает идентификатор callback страницы в роутах 
    getOAuthCallbackRoute(): string {
        return `/sso/${this.getAlias()}/authentication`;
    }

    // Возвращает идентификатор callback страницы в роутах 
    getOAuthErrorPageName(): string {
        return `/sso/${this.getAlias()}/error`;
    }

    // Вызывается при инициализации транспортного сервиса
    bootstrap(context: IDocHubContext) {
        //Регистрируем перехватчики переходов для OAuth
        this.DocHub.router.registerMiddleware({
            beforeEach: async(to, from, next) => {
                // Если мы не в режиме OAuth ничего не делаем
                if (this.config.mode !== ProtocolMode.oauth) {
                    next();
                    return;
                }
                // Иначе обрабатываем роуты
                switch (to.name) {
                    case this.getOAuthErrorPageName(): next(); break;
                    case this.getOAuthCallbackPageName(): {
                        debugger;
                        this.OAuthCode = Object.keys(to.query).length
                            ? to.query.code
                            : new URLSearchParams(to.hash.substr(1)).get('code');

                        this.refreshAccessToken()
                            .then(() => next(cookie.get(this.cookiesKeys.returnRoute) || '/'))
                            .catch(() => next(this.getOAuthErrorPageName()));
                        break;
                    }
                    default:
                        !to.fullPath.endsWith('/error') && cookie.set(this.cookiesKeys.returnRoute, to.fullPath, { expires: '300s' });
                        next();
                }
            }
        });
        // Регистрируем роут для редиректа при авторизации
        this.DocHub.router.registerRoute(
            {
                path: this.getOAuthCallbackRoute(),
                name: this.getOAuthCallbackPageName()   
            }
        );

        // Отслеживаем события шины
        this.DocHub.eventBus.$on(this.Events.loginRetry, () => {
            this.logout();
            this.login();
        });

        // Слушаем запросы о статусе
        this.DocHub.eventBus.$on(this.Events.statusGet, () => this.onChangeStatus());
        this.DocHub.eventBus.$on(this.Events.logout, () => this.logout());
        this.DocHub.eventBus.$on(this.Events.login, () => this.login());
        const restart = () => {
            // Перезапускаем драйвер
            this.active = this.restart(context);
            // Уведомляем всех слушателей шины, что у нас изменилось состояние
            this.onChangeStatus();
        };
        // Отслеживаем запросы на перезапуск драйвера
        this.DocHub.eventBus.$on(this.Events.restart, restart);
        // Стартуем
        restart();
    }
    
    // Возвращает список методов доступных над URI
    // eslint-disable-next-line no-unused-vars
    availableMethodsFor(uri: string): Promise<IDocHubProtocolMethods[]> {
        return new Promise((success) => {
            success([IDocHubProtocolMethods.GET]);
        });
    }

    refreshAccessToken() {
        return new Promise((success, reject) => {
            // Если процесс обновления токена уже запущен, ждем результат
            if (this.isOAuthProcessing) {
                const wait = () => {
                    if (!this.isOAuthProcessing) success(true);
                    else if (this.isOAuthProcessing === 'error') reject(new Error(`${this.getAlias()} authorized error!`));
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
                // Если нет кредлов для обновления токенов, падаем в ошибку
                if (!this.OAuthCode && !this.config.refreshToken) {
                    this.isOAuthProcessing = 'error';
                    reject(new Error(`${this.getAlias()}: No found OAuthCode or refreshToken for re-emission oauth tokens`));
                }
                this.isOAuthProcessing = true;
                // Создаем запрос на обновление токенов
                const request = this.makeOAuthRefreshTokenRequest(this.OAuthCode, this.config.refreshToken);
                request.then((response) => {
                    this.config.refreshToken = response.data.refresh_token || this.config.refreshToken;
                    this.config.accessToken = response.data.access_token;

                    cookie.set(this.cookiesKeys.tokenRefresh,  this.config.refreshToken);
                    cookie.set(this.cookiesKeys.tokenAccess, this.config.accessToken, {
                        expires: response.data.expires_in ? `${1 * response.data.expires_in - 60}s` :  '31536000s'
                    });
                    this.isOAuthProcessing = false;
                    success(true);
                }).catch((error) => {
                    // eslint-disable-next-line no-console
                    console.error(error);
                    this.isOAuthProcessing = 'error';
                    reject(error);
                });
            } else if (this.config.mode === ProtocolMode.personal) {
                return;
            } else 
                reject(new Error(`Can not refresh access token in mode ${this.config.mode}`));
        });   
    }

    // Разбирает URI формата <протокол>:<repo>:<branch>@<path>
    parseURL(url: string): IDecodedURI {
        const struct = url.split('@');
        const location = struct[0].split(':');
        return {
            repo: location[1],
            branch: location[2],
            path: struct[1].split('?')[0].split('#')[0]
        };
    }

    // Обогащает запрос IDocHubProtocolRequestConfig необходимыми данными для преобразования в IProtocolRequestConfig
    prepareRequestOptions(options: IDocHubProtocolRequestConfig): IProtocolRequestConfig  {
        // Декодируем URL
        if (!options.url) throw new Error(`${this.getAlias()}: Property URL of query options is required for decodeURL!`);
        const result : IProtocolRequestConfig = (options as IProtocolRequestConfig);
        result.originURL = options.url;
        result.decodeURI = this.parseURL((new URL(options.url)).toString());
        return result;
    }
    
    // Запрос к транспорту
    request(options: IDocHubProtocolRequestConfig): Promise<IDocHubProtocolResponse> {
        return new Promise((success, reject) => {
            if (!options.url) throw new Error(`${this.getAlias()}: Not defined url in request options!`);
            const origin = new URL(options.url);
            // Если протокол не gitlab сообщаем об ошибке
            if (origin.protocol !== `${this.getAlias()}:`) {
                const strError = `Invalid request by ${this.getAlias()} driver [${options.url}] `;
                // eslint-disable-next-line no-console
                console.error(strError, options);
                throw new Error(strError);
            }

            // Клонируем объект параметров для работ над ним
            options = Object.assign({}, options);

            const resolver = (options_: IProtocolRequestConfig) => {
                // Выполняем запрос к серверу
                this.fetch(options_)
                    .then((response: any) => {
                        // Предобрабатываем ответ идентифицируя тип контента по URL
                        const pathname = options_.decodeURI?.path || '';
                        let contentType: any = null;
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

            const preparedOptions = this.prepareRequestOptions(options);

            switch ((options.method || 'get').toLocaleLowerCase()) {
                case 'get': this.prepareGET(preparedOptions).then(resolver); break;
                case 'put': this.preparePUT(preparedOptions).then(resolver); break;
                case 'post': this.preparePOST(preparedOptions).then(resolver); break;
                case 'patch': this.preparePATCH(preparedOptions).then(resolver); break;
                default:
                    throw new Error(`Unsupported method [${options.method}] for ${this.getAlias()} driver!`);
            }
           
        });
    }

    // Выполняет фактический запрос
    fetch(options: IDocHubProtocolRequestConfig): Promise<any> {
        return new Promise((success, reject) => {
            if (this.config.mode === ProtocolMode.disable) {
                reject(new Error(`The ${this.getAlias()} driver is disabled.`));
            }
            const doIt = async() => {
                try {
                    // Если идет процесс авторизации - ждем
                    const authProcessingStatus = this.authService?.getOAuthProcessing();
                    if (authProcessingStatus === 'error')
                        reject(new Error(`${this.getAlias()} authorization error!`));
                    else if (authProcessingStatus || this.config.mode === null) {
                        setTimeout(() => doIt(), 100); // Попробуем позже
                        return;
                    }
    
                    // Добавляем реквизиты сессии
                    await this.applyCredentials(options);

                    // Контролируем дублирующиеся запросы и оптимизируем их
                    let hash;
                    // Следим только за GET, HEAD, OPTIONS
                    if (['get', 'head', 'options'].indexOf((options.method || 'get').toLowerCase()) >= 0 ) {
                        // Генерируем хез запроса
                        hash = objectHash(options);
                        // Создаем стек актуальных запросов, если его еще нет
                        this.actualRequest[hash] ||= [];
                        // Добавляем себя в стек
                        this.actualRequest[hash].push({ success, reject });
                    }
                    // Разрешаем запросы из стека
                    const resolve = (vector: string, data: any) => {
                        // Проверяем является ли запрос оптимизируемым
                        if (hash) {
                            // Если да, получаем весь стек запросов
                            const stack = this.actualRequest[hash] || [];
                            // Успешно разрешаем все запросы в стеке
                            while (stack.length > 0) {
                                stack.pop()?.[vector](data);
                            }
                            // Удаляем отработанный стек запросов
                            delete this.actualRequest[hash];
                        } else ({ success, reject }[vector])(data); // Иначе решаем единичный запрос
                    };
                    // Выполняем запрос только если он первый в очереди или неконтролируемый
                    (!hash || this.actualRequest[hash].length === 1) &&  axios(options as any)
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
    }    

    // *********************************************************************************
    //                      Методы требующие реализации
    // *********************************************************************************

    // Авторизация OAuth методом
    makeOAuthLoginURL() : string {
        throw new Error(`Method makeOAuthLoginURL is nor implemented for ${this.getAlias()}`);
    }

    // Добавляет в запрос необходимые реквизиты сессии
    // eslint-disable-next-line no-unused-vars
    applyCredentials(options: IDocHubProtocolRequestConfig) {
        throw new Error(`Method applyCredentials is nor implemented for ${this.getAlias()}`);
    }

    // Возвращает API-интерфейс драйвера
    getApi(): IGitAPI {
        throw new Error(`Method getApi is nor implemented for ${this.getAlias()}`);
    }

    // Разрешает URL
    //  ...segments: strings    - сегменты URL
    //  Results: URL            - URL сформированный на основании переданных параметров
    // eslint-disable-next-line no-unused-vars
    resolveURL(...segments: string[]): string {
        throw new Error(`Method resolveURL is nor implemented for ${this.getAlias()}`);
    }

    // Возвращает параметры среды
    // eslint-disable-next-line no-unused-vars
    getEnv(context): IProtocolEnvironments {
        throw new Error(`Method getEnv is nor implemented for ${this.getAlias()}`);
    }

    // Возвращает пользовательские настройки 
    // eslint-disable-next-line no-unused-vars
    getSettings(context): IProtocolSettings {
        throw new Error(`Method getSettings is nor implemented for ${this.getAlias()}`);
    }

    // Создает запрос к серверу для выпуска токенов авторизации
    // eslint-disable-next-line no-unused-vars
    makeOAuthRefreshTokenRequest(oauthCode: string | null, refreshToken?: string | null): Promise<any> {
        throw new Error(`Method makeOAuthRefreshTokenRequest is nor implemented for ${this.getAlias()}`);
    }

    // Подготавливает запрос к GET
    // eslint-disable-next-line no-unused-vars
    async prepareGET(options: IProtocolRequestConfig): Promise<IProtocolRequestConfig> {
        throw new Error(`Method prepareGET is nor implemented for ${this.getAlias()}`);
    }

    // Подготавливает запрос к PUT
    // eslint-disable-next-line no-unused-vars
    async preparePUT(options: IProtocolRequestConfig): Promise<IProtocolRequestConfig> {
        throw new Error(`Method preparePUT is not implemented in ${this.getAlias()}`);
    }

    // Подготавливает запрос к POST
    // eslint-disable-next-line no-unused-vars
    async preparePOST(options: IProtocolRequestConfig): Promise<IProtocolRequestConfig> {
        throw new Error(`Method preparePOST is not implemented in ${this.getAlias()}`);
    }

    // Подготавливает запрос к PATCH
    // eslint-disable-next-line no-unused-vars
    async preparePATCH(options: IProtocolRequestConfig): Promise<IProtocolRequestConfig> {
        throw new Error(`Method preparePATCH is not implemented in ${this.getAlias()}`);
    }
}

