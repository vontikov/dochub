/* Модуль работы с плагинами */
import Vue from 'vue';
import requests from '@front/helpers/requests';
import env from '@front/helpers/env';
import events from './events';
import storageManager from '@front/manifest/manager';
import protoProtocolDriver from './protoProtocolDriver';
import cookie from 'vue-cookie';

import { 
    IDocHubConstructorComponent,
    IDocHubConstructorItem,
    IDocHubConstructors,
    IDocHubContentProviders,
    IDocHubCore,
    IDocHubDocument,
    IDocHubDocuments,
    IDocHubEditor,
    IDocHubEditors,
    IDocHubProblems,
    IDocHubProtocol,
    IDocHubProtocols,
    IDocHubRouter,
    IDocHubSettings,
    IDocHubSettingsCollection,
    IDocHubUI,
    IDocHubUIComponent
} from 'dochub-sdk';
import { IDocHubContentProvider } from 'dochub-sdk/interfaces/content';

import { DocHubDataLake } from './datalake';

const plugins = {
    documents: [],          // Типы документов
    editors: [],            // Редакторы документов
    constructors: [],       // Конструкторы объектов
    protocols: [],          // Протоколы
    contentProviders: [],   // Драйверы данных
    routes: [],             // Роуты UI
    uiSettings: [],         // UI компоненты настроек плагинов
    uiComponents: [],       // Встраиваемые UI компоненты
    mounted: {},            // Примонтированные манифесты
    problems: []            // Проблемы возникшие в плагине
};

const routerMiddlewareMethods = { 
    beforeEach: true
};

// Карта соответствия полей настроек и переменных среды
const settingsMap = {
    rootManifest: 'VUE_APP_DOCHUB_ROOT_MANIFEST'
};

class DocHubCore implements IDocHubCore {
    env: any;
    events: any = events;
    eventBus: any = new Vue();
    constructor() {
        this.env = JSON.parse(JSON.stringify(process.env));
    }
    problems: IDocHubProblems = {
        emit: function(problem: Error, title?: string, uid?: string) {
            plugins.problems.push({
                uid: uid || `${Date.now()}`,
                title: title || problem?.toString(),
                correction: '',
                description: problem?.toString()
            });
        }
    };
    settings: IDocHubSettings = {
        registerUI: function(component: any, location: string, tags: string[]) {
            plugins.uiSettings.push({
                component,
                location,
                tags
            });

        },
        push: function(settings: IDocHubSettingsCollection) {
            DocHub.eventBus.$emit(events.settings.push, settings);
            Object.keys(settings).map((key) => {
                cookie.set(`$settings.${key}`, JSON.stringify(settings[key]), 60*60*24*365);
            });
        },
        pull: function(fields: IDocHubSettingsCollection | string[]): IDocHubSettingsCollection {
            const result = {};
            (Array.isArray(fields) ? fields : Object.keys(fields)).map((key) => {
                const def = (settingsMap[key] && process.env[settingsMap[key]]) || undefined;
                try {
                    result[key] = JSON.parse(cookie.get(`$settings.${key}`) || 'undefined');
                // eslint-disable-next-line no-empty
                } catch(error) {}
                result[key] ||= fields[key] || def;
            });
            return result;
        }
    };
    router: IDocHubRouter = {
        registerRoute: function(route: object) {
            window.Router.addRoute(route);
            plugins.routes.push(route);
        },
        registerMiddleware: function(middleware: object) {
            for (const method in middleware) {
                if (routerMiddlewareMethods[method]) {
                    window.Router[method](middleware[method]);
                } else throw new Error(`Unsupported middleware method [${method}] for plugins core!`);
            }
        },
        navigate: function(url: string) {
            const parseURL = new URL((url || '').split('/').filter((pice, index) => index === 0 || pice).join('/') || '/', window.location.href);
            if(parseURL.origin !== window.origin)
                window.open(url, '_blank');
            else 
                window.Router.push({ path: parseURL.pathname, query: Object.fromEntries(parseURL.searchParams), hash: parseURL.hash });
        }
    };
    contentProviders: IDocHubContentProviders = {
        get: function(contentType: string): IDocHubContentProvider {
            const provider = plugins.contentProviders.find(
                (item) => (new RegExp(item.contentType)).test(contentType.toLowerCase())
            )?.provider;
            // Если драйвер не хочет обрабатывать запросы, прячем его
            return provider?.isActive() ? provider : undefined;
        },
        register: function(contentType: string, provider: IDocHubContentProvider) {
            // Инициализируем драйвера протоколов
            try {
                // eslint-disable-next-line no-console
                console.info(`Initialization content driver [${contentType}]...`, plugins.contentProviders);
                provider.bootstrap && provider.bootstrap({
                    env: DocHub.env,
                    dochub: DocHub
                });
                plugins.contentProviders.push({ contentType, provider });
                // eslint-disable-next-line no-console
                console.info(`Content driver for [${contentType}] is registered.`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error of registration content driver for ${contentType}`, error);
            }
        },
        fetch: function(): string[] {
            return plugins.contentProviders.map((item) => item.contentType);
        }
    };
    protocols: IDocHubProtocols = {
        get: function(protocol: string): IDocHubProtocol {
            const driver = plugins.protocols.find(
                (item) => item.protocol.toLowerCase() === protocol.toLowerCase()
            )?.driver;
            // Если драйвер не хочет обрабатывать запросы, прячем его
            return driver?.isActive() ? driver : undefined;
        },
        register: function(protocol: string, driver: IDocHubProtocol) {
            // Инициализируем драйвера протоколов
            try {
                // eslint-disable-next-line no-console
                console.info(`Initialization protocol [${protocol}]...`);
                !(driver as any).__proto__ && ((driver as any).__proto__ = protoProtocolDriver);
                // driver = Object.assign({}, protoProtocolDriver, driver);
                driver.bootstrap && driver.bootstrap({
                    dochub: DocHub,
                    env: Object.keys(process.env).reduce((acc, key) => {
                        key.startsWith('VUE_APP_DOCHUB_') && (acc[key.slice(15)] = JSON.parse(JSON.stringify(process.env[key])));
                        return acc;
                    }, {})
                });
                plugins.protocols.push({ protocol, driver });
                // eslint-disable-next-line no-console
                console.info(`Protocol [${protocol}] is registered.`);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error of registration protocol ${protocol}`, error);
            }
        },
        fetch: function(): string[] {
            return plugins.protocols.map((item) => item.protocol); 
        }
    };
    documents: IDocHubDocuments = {
        register: function(type: string, component: IDocHubDocument) {
            plugins.documents.push({ type, component });
            Vue.component(`plugin-document-${type}`, component);
        },
        fetch: function(): string[] {
            return plugins.documents.map((item) => item.type);
        }
    };
    editors: IDocHubEditors = {
        register: function(type: string, editor: IDocHubEditor, title?: string) {
            plugins.editors.push({ type, component: editor, title: title || type });
            Vue.component(`plugin-editor-${type}`, editor);
        },
        fetch: function(): string[] {
            return plugins.editors.map((item) => item.type);
        }
    };
    ui: IDocHubUI = {
        register: function(slot: string, component: IDocHubUIComponent) {
            plugins.uiComponents.push({ slot, component });
        },
        get: function(slot: string): IDocHubUIComponent[] {
            return plugins.uiComponents.filter((item) => (item.slot === slot));
        }
    };
    constructors: IDocHubConstructors = {
        register: function(uid: string, title: string, component: IDocHubConstructorComponent) {
            plugins.constructors.push({uid, title, component});
        },
        fetch: function(): IDocHubConstructorItem[] {
            return plugins.constructors;
        },
        get: function(uid: string): IDocHubConstructorItem {
            return plugins.constructors.find((item) => item.uid === uid);
        }
    };

    dataLake = new DocHubDataLake(this);
}

const DocHub: DocHubCore = (window['DocHub'] = new DocHubCore());

export default {
    namespaced: true,
    state: {
        ...plugins,
        ready: false    // Признак готовности плагинов к использованию
    },
    mutations: {
        setReady(state, value) {
            state.ready = value;
        },
        refreshConstructors(state) {
            state.constructors = [...state.constructors];
        },
        refreshDocuments(state) {
            state.documents = [...state.documents];
        },
        refreshEditor(state) {
            state.editors = [...state.editors];
        },
        registerUIComponent(state, component) {
            state.uiComponents.push(component);
        },
        registerUISettings(state, component) {
            state.uiSettings.push(component);
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
            // Регистрируем менеджер редакторов для плагинов
            const oldEditorRegister = DocHub.editors.register;
            DocHub.editors.register = (type:string, component: any, title?: string) => {
                oldEditorRegister(type, component, title);
                context.commit('refreshEditors');
            };

            // Регистрируем менеджер документов для плагинов
            const oldDocumentRegister = DocHub.documents.register;
            DocHub.documents.register = (type, component: any) => {
                oldDocumentRegister(type, component);
                context.commit('refreshDocuments');
            };

            // Регистрируем менеджер конструкторов для плагинов
            const oldConstructorRegister = DocHub.constructors.register;
            DocHub.constructors.register = (uid: string, title: string, component: IDocHubConstructorComponent) => {
                oldConstructorRegister(uid, title, component);
                context.commit('refreshConstructors');
            };

            // Регистрируем UI компонентов настроек
            DocHub.settings.registerUI = (component, location, tags) => {
                context.commit('registerUISettings', { component, location, tags });
            };

            DocHub.ui.register = (location, component) => {
                context.commit('registerUIComponent', { location, component });
            };

            DocHub.dataLake.mountManifest = (uri) => {
                context.commit('mountManifest', uri);
                DocHub.eventBus.$emit(events.dataLake.mountManifest, uri);
            };

            DocHub.dataLake.unmountManifest = (uri) => {
                context.commit('unmountManifest', uri);
                DocHub.eventBus.$emit(events.dataLake.unmountManifest, uri);
            };

            let counter = 0;
            // Получаем данные манифеста приложения
            !env.isPlugin() && requests.request('/manifest.json', new URL('/', window.location.toString())).then((response) => {
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
