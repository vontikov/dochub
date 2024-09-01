// Универсальный сервис авторизации через dochub.info
import axios from 'axios';
import cookie from 'vue-cookie';
import OAuthError from '../components/errors/OAuthError.vue';

// Регистрируем универсальный роут для отражения ошибки авторизациии
DocHub.router.registerRoute({
    name: 'auth_service_error',
    path: '/sso/:driver/error',
    component: OAuthError
});

export default function(driver, address) {
    let isOAuthProcessing = false;                                          // Признак взаимодействия с сервером авторизации 

    const routes = {
        error: {
            name: 'auth_service_error',
            path: `/sso/${driver}/error`
        },
        callback: {
            name: `auth_service_${driver}_callback`,
            path: `/sso/${driver}/authentication`
        },
        service: {
            name: `auth_service_${driver}`,
            path: address || `https://registry.dochub.info/${driver}/oauth/proxy/login`
        }
    };

    // События
    this.onLogined = null;          // Вызывается при удачном завершении процесса авторизации
    this.onError = null;            // Вызывается при НЕудачном завершении процесса авторизации
    this.onChangeStatus = null;     // Вызывается при любом изменении статуса авторизации

    // Возвращает true если сессия активна
    this.isLogined = () => {
        return !isOAuthProcessing 
            && !!(
                cookie.get(`$access_token_${driver}`)
                || cookie.get(`$refresh_token_${driver}`)
            );
    };

    // Возвращает статус процесса авторизации
    this.getOAuthProcessing = () => {
        return isOAuthProcessing;
    };

    this.getAccessToken = async() => {
        if (isOAuthProcessing) return null;

        let token = cookie.get(`$access_token_${driver}`) || null;
        if (!token) {
            await this.refreshAccessToken();
            token = cookie.get(`$access_token_${driver}`) || null;
        }

        return token;
    };

    // Вызывает процесс авторизации на сервисе
    this.login = () => {
        this.logout();
        isOAuthProcessing = false;
        window.location = routes.service.path;
    };

    // Вызывает процесс завершения сессии
    this.logout = () => {
        cookie.delete(`$access_token_${driver}`);
        cookie.delete(`$refresh_token_${driver}`);
        cookie.delete(`$api_server_${driver}`);
    };

    // Возвращает API шлюз провайдера для взаимодействия с ним
    this.getAPIServer = () => {
        return cookie.get(`$api_server_${driver}`) || null;
    };

    // Вызывает обновление токена
    this.refreshAccessToken = (weclomeToken) => {
        return new Promise((success, reject) => {
            // Если процесс обновления токена уже запущен, ждем результат
            if (isOAuthProcessing) {
                const wait = () => {
                    if (!isOAuthProcessing) success();
                    else if (isOAuthProcessing === 'error') reject(new Error(`${driver} authorized error!`));
                    else setTimeout(wait, 100);
                };
                wait();
                return;
            } 
            // Если нет, запускаем процесс обновления токена доступа
            isOAuthProcessing = true;
            const token = weclomeToken || cookie.get(`$refresh_token_${driver}`);
            // Если токена обновления нет, сваливаемся в ошибку
            if (!token) {
                isOAuthProcessing = 'error';
                const error = new Error(`No refresh token for ${driver}`);
                this.onError && this.onError(error, this);
                reject(error);
                return;
            }
            // Иначе, идем в сервис авторизации за токеном доступа
            axios({
                method: 'get',
                url: (new URL(`/${driver}/oauth/proxy/access_token`, routes.service.path)).toString(),
                params: {
                    token
                }
            })
                .then((response) => {
                    // Сохраняем полученный токены для использования после перезагрузки
                    cookie.set(`$access_token_${driver}`, response.data.access_token, { expires: `${response.data.expires_in || 60*60*24*365}s` });
                    cookie.set(`$refresh_token_${driver}`, response.data.refresh_token, { expires: `${60*60*24*365}s` });
                    cookie.set(`$api_server_${driver}`, response.data.api_server, { expires: `${60*60*24*365}s` });
                    isOAuthProcessing = false;
                    this.onLogined && this.onLogined(this);
                    success();
                }).catch((error) => {
                    // eslint-disable-next-line no-console
                    console.error(error);
                    if (error?.code !== 'ERR_CANCELED') {
                        this.logout();
                        isOAuthProcessing = 'error';
                        this.onError && this.onError(error, this);
                        reject(error);
                    }
                }).finally(() => this.onChangeStatus && this.onChangeStatus(this));
        });
    };    

    // Перехватываем переходы на нужные роуты
    DocHub.router.registerMiddleware({
        beforeEach: async(to, from, next) => {
            switch (to.name) {
                case routes.error.name: next(); break;
                case routes.callback.name: {
                    this.refreshAccessToken(new URL(location.href).searchParams.get('token'))
                        .then(() => next(cookie.get(`$return-route-${driver}`) || '/'))
                        .catch(() => next(routes.error.path));
                    break;
                }
                default:
                    !to.fullPath.endsWith('/error') && cookie.set(`$return-route-${driver}`, to.fullPath, { expires: '300s' });
                    next();
            }
        }
    });

    // Регистрируем роут для редиректа при авторизации
    DocHub.router.registerRoute(routes.callback);
}



