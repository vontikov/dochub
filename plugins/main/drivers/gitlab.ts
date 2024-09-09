import { AccessToSetting, IProtocolEnvironments, IProtocolRequestConfig, IProtocolSettings, ProtocolMode, ProtoProtocol } from './Proto';
import { IDocHubProtocolRequestConfig } from 'dochub-sdk';
import { IGitAPI, IProtocolUserProfile } from './types';
import axios from 'axios';

const checkParams = function(funcName, params) {
    const result: string[] = [];
    for (const paramId in params) {
        if (!params[paramId]) result.push(paramId);
    }
    if (result.length)
        throw new Error(`API function ${funcName} cannot be called because variables are not defined: ${result.join(', ')}`);

    return true;
};

class GitLabAPI implements IGitAPI {
    driver: GitLabProtocol;
    currentBranch_: string | null = null;

    constructor(driver: GitLabProtocol) {
        this.driver = driver;
    }

    // Возвращает URL API шлюза
    getAPIServer() {
        return this.driver.authService?.getAPIServer() || this.driver.config.server || 'https://gitlab.com/';
    }
    // Возвращает текущий бранч
    currentBranch(): string | null {
        return this.currentBranch_;
    }
    async checkout(to: string, repo: string): Promise<any> {
        checkParams('checkout', { to, repo });
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const affects: RegExp[] = [];
        if (!this.currentBranch_) throw new Error('Can not switch branch! Not defined current branch.');
        this.currentBranch_ && (this.currentBranch_ !== to) && ((await this.compare(this.currentBranch_, to, repo))?.diffs || []).map((item: any) => {
            item.old_path && affects.push(
                new RegExp(item.old_path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            );
        });
        this.currentBranch_ = to;
        this.driver.onChangeStatus();
        this.driver.DocHub.dataLake.reload(affects.length ? affects : undefined);
    }

    // Сравнивает бранчи и возвращает разницу
    async compare(from: string, to: string, repo: string): Promise<any> {
        checkParams('compare', { to, repo });
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const result: any = (await this.driver.fetch({
            method: 'get',
            url: (new URL(`/api/v4/projects/${repo}/repository/compare?from=${from}&to=${to}&straight=true`, this.getAPIServer())).toString()
        })).data;

        return {
            diffs: result.diffs || []
        };
    }
    async getContent(uri: string): Promise<any> {
        checkParams('getContent', { uri });
        return this.driver.request({ url: uri });
    }
    async postContent(uri: string, content: any): Promise<any> {
        checkParams('postContent', { uri, content });
        return this.driver.request({ url: uri,  method: 'post', data: content});
    }
    // Возвращает список проектов
    async fetchRepos(): Promise<any> {
        return ((await this.driver.fetch({
            method: 'get',
            url: (new URL(`/api/v4/users/${this.driver.profile.userId || this.driver.profile?.id}/projects`, this.getAPIServer())).toString()
        })).data || []).map((item) => ({
            ...item,
            ref: `${item.id}`
        }));
    }
    // Возвращает список бранчей
    async fetchBranches(repo: string): Promise<any> {
        checkParams('fetchBranches', { repo });
        return (await this.driver.fetch({
            method: 'get',
            url: (new URL(`/api/v4/projects/${repo}/repository/branches`, this.getAPIServer())).toString()
        })).data;
    }
    // Возвращает список файлов
    async fetchFiles(path: string, branch: string, repo: string): Promise<any> {
        checkParams('fetchFiles', { branch, repo });
        return ((await this.driver.fetch({
            method: 'get',
            url: (new URL(`/api/v4/projects/${repo}/repository/tree?path=${encodeURIComponent(path || '')}&ref=${branch}`, this.getAPIServer())).toString()
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
        return (await this.driver.fetch({
            method: 'get',
            url: (new URL('/api/v4/user', this.getAPIServer())).toString()
        })).data;        
    }
    // eslint-disable-next-line no-unused-vars
    convertURL(url: string): string | null {
        checkParams('postContent', { url });
        throw new Error('НЕ РЕАЛИЗОВАНО ДЛЯ GITLAB!');
    }

}

export const DRIVER_ALIAS = 'gitlab';
const REQUESTED_SCOPES = 'read_repository+api+write_repository';
const NULL_ORIGIN = 'null://null/';

export class GitLabProtocol extends ProtoProtocol {
    api : GitLabAPI;
    isFixedSettings_ = false;   // Признак того, что пользователь может менять конфигурацию в настройках

    constructor() {
        super();
        this.api = new GitLabAPI(this);
    }

    getAlias(): string {
        return DRIVER_ALIAS;
    }

    // Авторизация OAuth методом
    makeOAuthLoginURL() : string {
        return (new URL(
            `/oauth/authorize?client_id=${this.config.appId}`
            + '&redirect_uri=' + new URL(this.getOAuthCallbackRoute(), window.location.toString())
            + `&response_type=code&state=none&scope=${REQUESTED_SCOPES}`
            + '&' + Math.floor(Math.random() * 10000)
            , this.config.server
        )).toString();
    }

    // Создает запрос к серверу для выпуска токенов авторизации
    makeOAuthRefreshTokenRequest(code: string | null, refresh_token?: string | null): Promise<any> {
        const params = (() => {
            if (code) {
                return {
                    grant_type: 'authorization_code',
                    code: code
                };
            } else if (refresh_token) {
                return {
                    grant_type: 'refresh_token',
                    refresh_token
                };
            }
        })(); 

        // Иначе указываем, что начали процесс авторизации
        this.isOAuthProcessing = true;
        // Идем в GitLab за токеном доступа
        return axios({
            method: 'post',
            url: (new URL('/oauth/token', this.config.server)).toString(),
            params: Object.assign({
                client_id: this.config.appId,
                redirect_uri: (new URL(this.getOAuthCallbackRoute(), window.location.toString())).toString()
            }, params)
        });
    }

    // Добавляет в запрос необходимые реквизиты сессии
    async applyCredentials(options: IDocHubProtocolRequestConfig): Promise<IDocHubProtocolRequestConfig> {
        // Добавляем данные для авторизации
        options.headers ||= {};
        switch(this.config.mode) {
            case ProtocolMode.oauth: 
                options.headers['Authorization'] = `Bearer ${this.config.accessToken}`;
                break;
            case ProtocolMode.registry:
                options.headers['Authorization'] = `Bearer ${await this.authService.getAccessToken()}`;
                break;
            case ProtocolMode.personal:
                options.headers['Authorization'] = `Bearer ${this.config.personalToken}`;
                break;
            default:
                throw new Error(`Can not resolve request to ${options.url} because mode "${this.config.mode}" is undefined for GitLab driver!`);
        }
        return options;
    }

    // Возвращает API-интерфейс драйвера
    getApi(): IGitAPI {
        return this.api;
    }

    // Разрешает URL
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

    isFixedSettings(): AccessToSetting {
        return this.isFixedSettings_ ? AccessToSetting.denied : AccessToSetting.available;
    }

    // Возвращает параметры среды
    getEnv(context): IProtocolEnvironments {
        const result: IProtocolEnvironments = {
            isDisable: (context?.env?.GITLAB_DISABLE || '').toLowerCase() === 'yes',
            server: context.env.GITLAB_URL,
            authService: context.env.GITLAB_AUTH_SERVICE,
            appId: context.env.GITLAB_APP_ID,
            appSecret: context.env.GITLAB_CLIENT_SECRET,
            personalToken: context.env.GITLAB_PERSONAL_TOKEN
        };
        this.isFixedSettings_ = result.isDisable || !!context.env.GITLAB_APP_ID;
        return result;
    }

    // Возвращает пользовательские настройки 
    getSettings(context): IProtocolSettings {
        const def = this.getEnv(context);
        const settings = this.DocHub.settings.pull({
            gitlabDisable: def.isDisable,
            gitlabAuthService: def.authService,
            gitlabServer: def.server,
            gitlabPersonalToken: def.personalToken
        });

        return {
            mode: (() => {
                if (settings.gitlabAuthService) return ProtocolMode.registry;
                else if (settings.gitlabPersonalToken) return ProtocolMode.personal;
                else return ProtocolMode.disable;
            })(),
            server: settings.gitlabServer,
            authService: settings.gitlabAuthService,
            personalToken: settings.gitlabPersonalToken
        };
    }

    // Возвращает профиль пользователя
    getPublicUserProfile(data: any): IProtocolUserProfile {
        return {
            avatarURL: data?.avatar_url,
            userName: data?.name
        };
    }

    // Подготавливает запрос к GET
    // eslint-disable-next-line no-unused-vars
    async prepareGET(options: IProtocolRequestConfig): Promise<IProtocolRequestConfig> {
        // Формируем URL запроса
        options.url = new URL(
            `api/v4/projects/${options.decodeURI.repo}/repository/files/${encodeURIComponent(options.decodeURI.path)}/raw?ref=${options.decodeURI.branch}&random=${Date.now()}`
            , this.api.getAPIServer()).toString();
        return options;
    }

    // Подготавливает запрос к PUT
    async preparePUT(options: IProtocolRequestConfig): Promise<IProtocolRequestConfig> {
        options.url = new URL(`/api/v4/projects/${options.decodeURI.repo}/repository/commits`, this.api.getAPIServer()).toString();
        options.method = 'post';
        options.headers = Object.assign(options.headers, {
            'Content-type': 'application/json; charset=UTF-8'
        });
        options.data = {
            branch: options.decodeURI.branch,
            commit_message: 'DocHub automatic commit',
            actions: [
                {
                    action: 'update',
                    file_path: options.decodeURI.path,
                    content: options.data
                }
            ]
        };
        return options;
    }
}

const GitLabDriver = new GitLabProtocol();

export default GitLabDriver;
