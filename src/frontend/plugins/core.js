/* Модуль работы с плагинами */
import Vue from 'vue';
import requests from '@front/helpers/requests';
import env from '@front/helpers/env';
import events from './events';
import storageManager from '@front/manifest/manager';
import protoProtocolDriver from './protoProtocolDriver';
import cookie from 'vue-cookie';

const plugins = {
    documents: [],          // Типы документов
    protocols: [],          // Протоколы
    contentProviders: [],   // Драйверы данных
    routes: [],             // Роуты UI
    uiComponents: [],       // Встраиваемые UI компоненты
    mounted: {},            // Примонтированные манифесты
    // Все ранее зарегистрированные плагины переносим в основной менеджер
    pull() {
        for(const uri in this.mounted) {
            storageManager.mountManifest(uri);
        }
        this.documents.forEach((el) => DocHub.documents.register(el.type, el.component));

    }
};

const routerMiddlewareMethods = { 
    beforeEach: true
};

// Карта соответствия полей настроек и переменных среды
const settingsMap = {
    rootManifest: 'VUE_APP_DOCHUB_ROOT_MANIFEST'
};

// Регистрируем временный менеджер регистрации плагинов
window.DocHub = {
    env: JSON.parse(JSON.stringify(process.env)),
    events,
    eventBus: new Vue(),
    // Работа с настройками
    settings: {
        push(settings) {
            DocHub.eventBus.$emit(events.settings.push, settings);
            Object.keys(settings).map((key) => {
                cookie.set(`$settings.${key}`, settings[key], 60*60*24*365);
            });
        },
        pull(fields) {
            const result = {};
            (Array.isArray(fields) ? fields : Object.keys(fields)).map((key) => {
                const def = (settingsMap[key] && process.env[settingsMap[key]]) || undefined;
                result[key] = cookie.get(`$settings.${key}`) || fields[key] || def;
            });
            return result;
        }
    },
    router: {
        registerRoute(route) {
            window.Router.addRoute(route);
            plugins.routes.push(route);
        },
        registerMiddleware(middleware) {
            for (const method in middleware) {
                if (routerMiddlewareMethods[method]) {
                    window.Router[method](middleware[method]);
                } else throw new Error(`Unsupported middleware method [${method}] for plugins core!`);
            }
        }
    },
    contentProviders: {
        get(contentType) {
            const driver = plugins.contentProviders.find(
                (item) => (new RegExp(item.contentType)).test(contentType.toLowerCase())
            )?.driver;
            // Если драйвер не хочет обрабатывать запросы, прячем его
            return driver?.isActive() ? driver : undefined;
        },
        register(contentType, driver) {
            // Инициализируем драйвера протоколов
            try {
                // eslint-disable-next-line no-console
                console.info(`Initialization content driver [${contentType}]...`, plugins.contentProviders);
                driver.bootstrap && driver.bootstrap({
                    env: window.DocHub.env
                });
                plugins.contentProviders.push({ contentType, driver });
                // eslint-disable-next-line no-console
                console.info(`Content driver for [${contentType}] is registered.`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error of registration content driver for ${contentType}`, error);
            }
        },
        fetch() {
            return JSON.parse(JSON.stringify(plugins.contentProviders));
        }
    },
    protocols: {
        get(protocol) {
            const driver = plugins.protocols.find(
                (item) => item.protocol.toLowerCase() === protocol.toLowerCase()
            )?.driver;
            // Если драйвер не хочет обрабатывать запросы, прячем его
            return driver?.isActive() ? driver : undefined;
        },
        register(protocol, driver) {
            // Инициализируем драйвера протоколов
            try {
                // eslint-disable-next-line no-console
                console.info(`Initialization protocol [${protocol}]...`);
                driver = Object.assign({}, protoProtocolDriver, driver);
                driver.bootstrap && driver.bootstrap({
                    env: JSON.parse(JSON.stringify(process.env))
                });
                plugins.protocols.push({ protocol, driver });
                // eslint-disable-next-line no-console
                console.info(`Protocol [${protocol}] is registered.`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error of registration protocol ${protocol}`, error);
            }
        },
        fetch() {
            return JSON.parse(JSON.stringify(plugins.protocols));
        }
    },
    documents: {
        register(type, component) {
            plugins.documents.push({ type, component });
        },
        fetch() {
            return JSON.parse(JSON.stringify(plugins.documents));
        }
    },
    ui: {
        // location
        //      avatar - область справа сверху в главном меню
        register(location, component) {
            plugins.uiComponents.push({ location, component });
        },
        fetch() {
            return JSON.parse(JSON.stringify(plugins.uiComponents));
        }
    },
    // API озера данных
    dataLake: {
        // Монтирует источник к загружаемым манифестам озера
        //  uri: string     - URI монтируемого ресурса
        mountManifest(uri) {
            plugins.mounted[uri] = true;
            DocHub.eventBus.$emit(events.dataLake.mountManifest, uri);
        },
        // Монтирует источник к загружаемым манифестам озера
        //  uri: string     - URI отключаемого ресурса
        unmountManifest(uri) {
            delete plugins.mounted[uri];
            DocHub.eventBus.$emit(events.dataLake.unmountManifest, uri);
        },
        // Требует перезагрузки ресурсов задействованных в озере данных
        //  uriPattern: array | RegEx | undefined  - Шаблон проверки соответствия URI ресурса
        //                                   Если undefined - перезагружает все
        reload(uriPattern) {
            DocHub.eventBus.$emit(events.dataLake.reloadManifests, 
                uriPattern && 
                    ((Array.isArray(uriPattern) ? uriPattern : [uriPattern]).map((item) => 
                            typeof item === 'string'
                            ? new RegExp('^' + item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$')
                            : item
                        )
                    )
            );
        }
    }
};

export default {
    namespaced: true,
    state: {
        ...plugins,
        ready: false,   // Признак готовности плагинов к использованию
        documents: {}   // Доступные типы документов
    },
    mutations: {
        setReady(state, value) {
            state.ready = value;
        },
        registerDocument(state, document) {
            state.documents[document.type] = document.component;
        },
        registerUIComponent(state, component) {
            state.uiComponents.push(component);
        },
        mountManifest(state, uri) {
            state.mounted[uri] = true;
            storageManager.mountManifest(uri);
        },
        unmountManifest(state, uri) {
            delete state.mounted[uri];
            storageManager.unmountManifest(uri);
        }
    },
    actions: {
        // Загружаем плагины
        init(context) {
            // Регистрируем менеджер документов для плагинов
            DocHub.documents.register = (type, component) => {
                component.mixins = component.mixins || [];
                Vue.component(`plugin-doc-${type}`, component);
                context.commit('registerDocument', { type, component });
            };

            DocHub.ui.register = (location, component) => {
                context.commit('registerUIComponent', { location, component });
            };

            // Регистрируем функцию получения доступных типов документов
            DocHub.documents.fetch = () => {
                return JSON.parse(JSON.stringify(Object.keys(context.state.documents || {})));
            };

            DocHub.dataLake.mountManifest = (uri) => {
                context.commit('mountManifest', uri);
                DocHub.eventBus.$emit(events.dataLake.mountManifest, uri);
            };

            DocHub.dataLake.unmountManifest = (uri) => {
                context.commit('unmountManifest', uri);
                DocHub.eventBus.$emit(events.dataLake.unmountManifest, uri);
            };

            plugins.pull();

            let counter = 0;

            // Получаем данные манифеста приложения
            !env.isPlugin() && requests.request('/manifest.json', new URL('/', window.location)).then((response) => {
                (response?.data?.plugins || []).map((url) => {
                    counter++;

                    const decCounter = () => !(--counter) && context.commit('setReady', true);

                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = function() {
                        // eslint-disable-next-line no-console
                        console.info(`Плагина [${url}] успешно подключен`);
                        decCounter();
                    };
                    script.onerror = (e) => {
                        // eslint-disable-next-line no-console
                        console.error(`Ошибка загрузки плагина [${url}]`, e);
                        decCounter();
                    };
                    document.head.appendChild(script);

                    if (!counter) context.commit('setReady', true);
                });
            }).catch((e) => {
                // eslint-disable-next-line no-console
                console.error('Не удалось загрузить манифест приложения', e);
                context.commit('setReady', true);
            });
        }
    }
};
