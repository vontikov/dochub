import storageManager from '@front/manifest/manager';
import gateway from '@idea/gateway';
import consts from '@front/consts';
import rules from '@front/helpers/rules';
import crc16 from '@global/helpers/crc16';
import entities from '@front/entities/entities';
import env, { Plugins } from '@front/helpers/env';
import plugins from '../plugins/core';
import editors from '../plugins/editors';

import validatorErrors from '@front/constants/validators';

const NET_CODES_ENUM = {
    NOT_FOUND: 404
};

export default {
    modules: {
        plugins,
        editors
    },
    state: {
        // Признак загрузки данных
        isReloading: true,
        // Признак рендеринга в версии для печати
        isPrintVersion: false,
        // Обобщенный манифест
        manifest: {},
        // Выявленные Проблемы
        problems: [],
        // Источники данных манифеста
        sources: {},
        // Движок для рендеринга
        renderCore: 'graphviz',
        // Признак инциализации проекта в плагине
        notInited: null,
        // Признак критической проблемы
        criticalError: null
    },

    mutations: {
        clean(state) {
            state.manifest = {};
            state.problems = [];
            state.sources = {};
            state.last_changes = {};
            state.criticalError = null;
        },
        setManifest(state, value) {
            state.manifest = value;
        },
        setSources(state, value) {
            state.sources = value;
        },
        setIsReloading(state, value) {
            state.isReloading = value;
        },
        appendProblems(state, value) {
            state.problems = state.problems.concat([value]);
        },
        setRenderCore(state, value) {
            state.renderCore = value;
        },
        setNoInited(state, value) {
            state.notInited = value;
        },
        setCriticalError(state, value) {
            state.criticalError = value;
        },
        setPrintVersion(state, value) {
            state.isPrintVersion = value;
        }
    },

    actions: {
        // Action for init store
        init(context) {
            context.dispatch('plugins/init');

            const errors = {
                count: 0,
                core: null,
                syntax: null,
                net: null,
                missing_files: null,
                package: null,
                plugins: context.state.plugins?.problems?.length ? {
                    id: '$error.plugins',
                    title: validatorErrors.title.plugins,
                    items: context.state.plugins.problems,
                    location: '',
                    critical: true
                } : undefined
            };

            context.commit('setRenderCore',
                env.isPlugin(Plugins.idea) ? 'smetana' : 'graphviz'
            );

            let tickCounter = 0;
            let rulesContext = null;

            storageManager.onReloaded = (parser) => {
                // eslint-disable-next-line no-console
                console.info('TIME OF RELOAD SOURCES = ', (Number.parseFloat((Date.now() - tickCounter) / 1000)).toFixed(4));
                // Очищаем прошлую загрузку
                context.commit('clean');
                // Регистрируем обнаруженные ошибки
                errors.core && context.commit('appendProblems', errors.core);
                errors.syntax && context.commit('appendProblems', errors.syntax);
                errors.net && context.commit('appendProblems', errors.net);
                errors.missing_files && context.commit('appendProblems', errors.missing_files);
                errors.package && context.commit('appendProblems', errors.package);
                errors.plugins && context.commit('appendProblems', errors.plugins);

                const manifest = Object.freeze(parser.manifest);
                // Обновляем манифест и фризим объекты
                context.commit('setManifest', manifest);
                context.commit('setSources', parser.mergeMap);
                if (!Object.keys(context.state.manifest || {}).length) {
                    context.commit('setCriticalError', true);
                }

                entities(manifest);
                context.commit('setIsReloading', false);
                const startRules = Date.now();
                rulesContext = rules(manifest,
                    (problems) => context.commit('appendProblems', problems),
                    (error) => {
                        // eslint-disable-next-line no-console
                        console.error(error);
                        context.commit('appendProblems', error);
                    });
                // eslint-disable-next-line no-console
                console.info('TIME OF EXECUTE RULES = ', (Number.parseFloat((Date.now() - startRules) / 1000)).toFixed(4));
                // eslint-disable-next-line no-console
                console.info('TIME OF FULL RELOAD = ', (Number.parseFloat((Date.now() - tickCounter) / 1000)).toFixed(4));
                // eslint-disable-next-line no-console
                console.info('MEMORY STATUS ', window?.performance?.memory);
            };

            storageManager.onStartReload = () => {
                rulesContext && rulesContext.stop();
                tickCounter = Date.now();
                errors.count = 0;
                errors.syntax = null;
                errors.net = null;
                errors.missing_files = null;
                errors.package = null;
                errors.core = null;

                context.commit('setNoInited', null);
                context.commit('setIsReloading', true);
            };
            storageManager.onError = (action, data) => {
                errors.count++;
                const error = data.error || {};
                const url = (data.error.config || { url: data.uri }).url;
                const uid = '$' + crc16(url);
                if (action === 'core') {
                    if (!errors.core) {
                        errors.core = {
                            id: '$error.core',
                            title: validatorErrors.title.core,
                            items: [],
                            critical: true
                        };
                    }

                    errors.core.items.push({
                        uid,
                        title: validatorErrors.title.core,
                        correction: validatorErrors.correction.core,
                        description: `${validatorErrors.description.core}:\n\n${error.toString()}\n\nStackTace:\n\n${error?.stack}`,
                        location: url
                    });

                } else if (action === 'syntax') {
                    if (!errors.syntax) {
                        errors.syntax = {
                            id: '$error.syntax',
                            title: validatorErrors.title.syntax,
                            items: [],
                            critical: true
                        };
                    }
                    const source = error.source || {};
                    const range = source.range || {};
                    if (!errors.syntax.items.find((item) => item.uid === uid)) {
                        errors.syntax.items.push({
                            uid,
                            title: url,
                            correction: validatorErrors.correction.in_file,
                            description: `${validatorErrors.description.manifest_syntax}:\n\n`
                                + `${error.toString()}\n`
                                + `${validatorErrors.parts.code}: ${source.toString()}`
                                + `${validatorErrors.parts.range}: ${range.start || '--'}..${range.end || '--'}`,
                            location: url
                        });
                    }
                } else if (action === 'package') {
                    if (errors.package?.items.find(({ description }) => description === `${error.toString()}\n`)) return;
                    if (!errors.package) {
                        errors.package = {
                            id: '$error.package',
                            items: [],
                            critical: true
                        };
                    }
                    const item = {
                        uid,
                        title: url,
                        correction: 'Проверьте зависимости и импорты',
                        description: '',
                        location: url
                    };

                    item.description = `${error.toString()}\n`;
                    errors.package.items.push(item);
                } else if (data.uri === consts.plugin.ROOT_MANIFEST || action === 'file-system') {
                    context.commit('setNoInited', true);
                } else {
                    const item = {
                        uid,
                        title: url,
                        correction: '',
                        description: '',
                        location: url
                    };

                    if (error.response?.status === NET_CODES_ENUM.NOT_FOUND) {
                        if (!errors.missing_files) {
                            errors.missing_files = {
                                id: '$error.missing_files',
                                items: [],
                                critical: true
                            };
                        }

                        item.correction = validatorErrors.correction.missing_files;
                        item.description = `${validatorErrors.description.missing_files}:\n\n`
                            + `${decodeURIComponent(url.toString()).split('/').splice(3).join(' -> ')}\n`;
                        errors.missing_files.items.push(item);
                    } else {
                        if (!errors.net) {
                            errors.net = {
                                id: '$error.net',
                                items: [],
                                critical: true
                            };
                        }

                        item.correction = validatorErrors.correction.net;
                        item.description = `${validatorErrors.description.net}:\n\n`
                            + `${error.toString()}\n`;
                        errors.net.items.push(item);
                    }

                    // Может не надо? 
                    context.commit('setIsReloading', false);
                }

                if (errors.count > 1) context.commit('setNoInited', false);
            };

            context.dispatch('reloadAll');
            
            let refreshTimer = null;

            const reloadSource = (target) => {
                if (refreshTimer) clearTimeout(refreshTimer);
                refreshTimer = setTimeout(async() => {
                    rulesContext && rulesContext.stop();
                    tickCounter = Date.now();
                    if (target === 'all') {
                        // eslint-disable-next-line no-console
                        console.info('>>>>>> FULL RELOAD <<<<<<<<');
                        context.dispatch('reloadAll');
                    } else {
                        let changes = [];
                        const makeRegExp = (str) => {
                            return new RegExp('^' + str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'); 
                        };
                        if (typeof target === 'string') changes.push(makeRegExp(target));
                        else if (Array.isArray(target)) changes = target;
                        else if (typeof target === 'object') changes = Object.keys(target).map((source) => makeRegExp(source));

                        // eslint-disable-next-line no-console
                        console.info('>>>>>> ON CHANGED SOURCES <<<<<<<<', changes);
                        await storageManager.onChange(changes);
                    }
                    refreshTimer = null;
                }, 350);
            };

            // Слушаем события от IDE
            gateway.appendListener('source/changed', (changes) => changes && reloadSource());
            // Слушаем события от плагинов

            // Если какой-то манифест изменился, обновляем данные в DataLake
            DocHub.eventBus.$on(DocHub.events.dataLake.reloadManifests, (changes) => {
                reloadSource(changes || 'all');
            });

            // Если прилетело сообщение о необходимости изменения настроек - обновляем их
            DocHub.eventBus.$on(DocHub.events.settings.push, 
                (settings) => settings.rootManifest && reloadSource('all')
            );
        },

        // Reload root manifest
        async reloadRootManifest() {
            // Если работаем в режиме backend, берем все оттуда
            if (env.isBackendMode()) {
                storageManager.onStartReload();
                storageManager.onReloaded({
                    manifest: Object.freeze({}),
                    mergeMap: Object.freeze({})
                });
            } else {
                await storageManager.reloadManifest();
            }
        },

        // Reload root manifest
        reloadAll(context) {
            context.dispatch('reloadRootManifest');
        },

        // Регистрация проблемы
        registerProblem(context, problem) {
            context.commit('appendProblem', problem);
        }
    }
};
