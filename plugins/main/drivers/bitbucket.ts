import { AccessToSetting, IProtocolEnvironments as IProtocolEnvironments, IProtocolRequestConfig, IProtocolSettings, ProtocolMode, ProtoProtocol } from './Proto';
import { IGitAPI, IProtocolUserProfile } from './types';
import consts from '../consts';
import { IDocHubProtocolRequestConfig } from 'dochub-sdk';

class BitbucketAPI implements IGitAPI {

    driver: BitbucketProtocol;
    currentBranch_: string | null = null;

    constructor(driver: BitbucketProtocol) {
        this.driver = driver;
    }

    // Возвращает текущий бранч
    currentBranch(): string | null {
        return this.currentBranch_;
    }

    // Возвращает URL API шлюза
    getAPIServer(): string {
        return this.driver.authService?.getAPIServer()
            || (() => {
                if (!this.driver.config.server) return null;
                const url = new URL(this.driver.config.server);
                return `${url.protocol}//api.${url.host}/2.0/`;
            })() 
            || consts.PUBLIC_API_SERVER;
    }
    // Переключает бранч
    async checkout(to: string, repo: string, owner: string): Promise<any> {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const affects: RegExp[] = [];
        if (!this.currentBranch) throw new Error('Can not switch branch! Not defined current branch.');
        this.currentBranch_ && (this.currentBranch_ !== to) && ((await this.compare(this.currentBranch_, to, repo, owner))?.diffs || []).map((item: any) => {
            item.old_path && affects.push(
                new RegExp(item.old_path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            );
        });
        this.currentBranch_ = to;
        this.driver.onChangeStatus();
        this.driver.DocHub.dataLake.reload(affects.length ? affects : undefined);
    }
    // Сравнивает бранчи и возвращает разницу
    async compare(from: string, to: string, repo: string, owner: string): Promise<any> {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const result = (await this.driver.fetch({
            method: 'get',
            url: (new URL(`/repos/${owner || this.driver.profile?.username}/${repo}/compare/${from}...${to}`, this.getAPIServer())).toString()
        })).data;

        return {
            diffs: result.files || []
        };
    }
    // Возвращает контент по указанному URI
    getContent(uri: string): Promise<any> {
        return this.driver.request({ url: uri });
    }
    // Создает контент с указанным URI
    postContent(uri: string, content: any): Promise<any> {
        return this.driver.request({ url: uri,  method: 'post', data: content});
    }
    // Возвращает список проектов
    async fetchRepos(): Promise<any> {
        return (await this.driver.fetch({
            method: 'get',
            url: (new URL('repositories?role=member', this.getAPIServer())).toString()
        })).data?.values?.map((item) => ({
            ...item,
            ref: item.full_name
        })) || [];
    }
    // Возвращает список бранчей
    async fetchBranches(repo: string): Promise<any> {
        return (await this.driver.fetch({
            method: 'get',
            url: (new URL(`repositories/${repo}/refs`, this.getAPIServer())).toString()
        })).data?.values || [];
    }
    // Возвращает профиль пользователя
    async fetchUser(): Promise<any> {
        return (await this.driver.fetch({
            method: 'get',
            url: (new URL('user', this.getAPIServer())).toString()
        })).data;
    }
    // Возвращает список файлов
    async fetchFiles(path: string, branch: string, repo: string): Promise<any> {
        return ((await this.driver.fetch({
            method: 'get',
            url: (new URL(`repositories/${repo}/src/${branch}/${encodeURIComponent(path)}`, this.getAPIServer())).toString()
        })).data?.values || []).map((item) => ({
            ...item,
            name: item.path.split('/').pop(),
            type: {
                'commit_directory': 'dir'
            }[item.type] || 'file'
        }));

    }
    // Конвертирует URL во внутренний формат протокола
    // eslint-disable-next-line no-unused-vars
    convertURL(url: string): string | null {
        throw new Error('НЕ РЕАЛИЗОВАНО ДЛЯ BITBUCKET!');
        /*
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
        */
    }
}

const NULL_ORIGIN = 'null://null/';

export const DRIVER_ALIAS = 'bitbucket';

export class BitbucketProtocol extends ProtoProtocol {

    isFixedSettings_ = false;   // Признак того, что пользователь может менять конфигурацию в настройках

    api : BitbucketAPI;

    constructor() {
        super();
        this.api = new BitbucketAPI(this);
    }

    getAlias(): string {
        return DRIVER_ALIAS;
    }

    // Авторизация OAuth методом
    makeOAuthLoginURL() : string {
        return (new URL(
            '/site/oauth2/authorize'
            + `?client_id=${this.config.appId}`
            + '&response_type=code'
            + `&${Math.floor(Math.random() * 10000)}`
            , this.config.server
        )).toString();
    }

    // Добавляет в запрос необходимые реквизиты сессии
    // eslint-disable-next-line no-unused-vars
    async applyCredentials(options: IDocHubProtocolRequestConfig): Promise<IDocHubProtocolRequestConfig> {
        // Определяем необходимые заголовки для github
        options.headers = Object.assign(
            options.headers || {},
            {
                'Accept': 'application/json'
            }
        );

        // Добавляем данные для авторизации
        switch(this.config.mode) {
            case ProtocolMode.oauth: 
                options.headers['Authorization'] = `Bearer ${this.config.accessToken}`;
                break;
            case ProtocolMode.registry:
                options.headers['Authorization'] = `Bearer ${await this.authService.getAccessToken()}`;
                break;
            case ProtocolMode.personal:
                if (!this.config.username || !this.config.personalToken)
                    throw new Error(`${this.getAlias()}: Is not defined username or personalToken in credentials!`);
                options.auth = {
                    username: this.config.username,
                    password: this.config.personalToken
                };
                break;
            default:
                throw new Error(`Can not resolve request to ${options.url} because mode "${this.config.mode}" is undefined for Bitbucket driver!`);
        }

        return options;
    }


    // Возвращает API-интерфейс драйвера
    getApi(): IGitAPI {
        return this.api;
    }

    // Разрешает URL
    // eslint-disable-next-line no-unused-vars
    resolveURL(...segments: string[]): string {
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
        segments.map((segment) => segment && applySegment(segment));

        result =
            result?.path && (
                (result?.branch ? `${result.branch}@` : '') + result?.path
            ) || undefined;

        return result;
    }

    isFixedSettings():AccessToSetting {
        return this.isFixedSettings_ ? AccessToSetting.denied : AccessToSetting.available;
    }

    // Возвращает профиль пользователя
    getPublicUserProfile(data: any): IProtocolUserProfile {
        return {
            avatarURL: data?.links?.avatar?.href,
            userName: data?.username
        };
    }

    // Возвращает параметры среды
    // eslint-disable-next-line no-unused-vars
    getEnv(context): IProtocolEnvironments {
        const result: IProtocolEnvironments = {
            isDisable: (context?.env?.BITBUCKET_DISABLE || '').toLowerCase() === 'yes',
            server: context.env.BITBUCKET_URL,
            authService: context.env.BITBUCKET_AUTH_SERVICE,
            appId: context.env.BITBUCKET_APP_ID,
            appSecret: context.env.BITBUCKET_CLIENT_SECRET,
            username: context.env.BITBUCKET_USERNAME,
            personalToken: context.env.BITBUCKET_PERSONAL_TOKEN
        };
        this.isFixedSettings_ = result.isDisable || !!context.env.BITBUCKET_APP_ID;
        return result;
    }

    // Возвращает пользовательские настройки 
    // eslint-disable-next-line no-unused-vars
    getSettings(context): IProtocolSettings {
        const def = this.getEnv(context);
        const settings = this.DocHub.settings.pull({
            bitbucketDisable: def.isDisable,
            bitbucketAuthService: def.authService,
            bitbucketServer: def.server,
            bitbucketUsername: def.username,
            bitbucketPersonalToken: def.personalToken
        });
        return {
            mode: (() => {
                if (settings.bitbucketAuthService) return ProtocolMode.registry;
                else if (settings.bitbucketPersonalToken) return ProtocolMode.personal;
                else return ProtocolMode.disable;
            })(),
            server: settings.bitbucketServer,
            authService: settings.bitbucketAuthService,
            username: settings.bitbucketUsername,
            personalToken: settings.bitbucketPersonalToken
        };
    }

    // Подготавливает запрос к GET
    // eslint-disable-next-line no-unused-vars
    async prepareGET(options: IProtocolRequestConfig): Promise<IProtocolRequestConfig> {
        options.url = (new URL(
            `repositories/${options.decodeURI.repo}/src/${options.decodeURI.branch}/${encodeURIComponent(options.decodeURI.path || '')}?&random=${Date.now()}`
            , this.api.getAPIServer()
        )).toString();
        return options;
    }
}

const BitbucketDriver = new BitbucketProtocol();

export default BitbucketDriver;
