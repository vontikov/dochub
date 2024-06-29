/* Модуль работы с плагинами */
import Vue from 'vue';
import requests from '@front/helpers/requests';
import env from '@front/helpers/env';

const plugins = {
    documents: [],  
    protocols: [],
    contentProviders: [], 
    // Все ранее зарегистрированные плагины переносим в основной менеджер
    pull() {
        this.documents.forEach((el) => DocHub.registerDocuments(el.type, el.component));
    }
};

// Регистрируем временный менеджер регистрации плагинов
window.DocHub = {
    contentProviders: {
        get(contentType) {
            const driver = plugins.contentProviders.find(
                (item) => item.contentType.toLowerCase() === contentType.toLowerCase()
            )?.driver;
            // Если драйвер не хочет обрабатывать запросы, прячем его
            return driver?.isActive() ? driver : undefined;
        },
        register(contentType, driver) {
            // Инициализируем драйвера протоколов
            try {
                // eslint-disable-next-line no-console
                console.info(`Initialization content driver [${contentType}]...`);
                driver.bootstrap && driver.bootstrap({
                    env: JSON.parse(JSON.stringify(process.env))
                });
                plugins.contentProviders.push({ contentType, driver });
                // eslint-disable-next-line no-console
                console.info(`Content driver for [${contentType}] is registered.`);
            } catch (error) {
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
                driver.bootstrap && driver.bootstrap({
                    env: JSON.parse(JSON.stringify(process.env))
                });
                plugins.protocols.push({ protocol, driver });
                // eslint-disable-next-line no-console
                console.info(`Protocol [${protocol}] is registered.`);
            } catch (error) {
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
    }
};

export default {
    namespaced: true,
    state: {
        ready: false,   // Признак готовности плагинов к использованию
        documents: {},  // Доступные типы документов
        protocols: {}   // Доступные протоколы
    },
    mutations: {
        setReady(state, value) {
            state.ready = value;
        },
        registerDocument(state, document) {
            state.documents[document.type] = document.component;
        }
    },
    actions: {
        // Загружаем плагины
        init(context) {
            // Регистрируем менеджер документов для плагинов
            window.DocHub.documents.register = function(type, component) {
                component.mixins = component.mixins || [];
                Vue.component(`plugin-doc-${type}`, component);
                context.commit('registerDocument', { type, component });
            };

            // Регистрируем функцию получения доступных протоколов
            window.DocHub.protocols.fetch = () => {
                return JSON.parse(JSON.stringify(Object.keys(context.state.protocols || {})));
            };

            // Регистрируем функцию получения доступных типов документов
            window.DocHub.documents.fetch = () => {
                return JSON.parse(JSON.stringify(Object.keys(context.state.documents || {})));
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
