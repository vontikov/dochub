import jsonataDriver from '@global/jsonata/driver.mjs';
import queries from '@global/jsonata/queries.mjs';
import env from '@front/helpers/env';
import requests from '@front/helpers/requests';

// Возвращает тело запроса в зависимости от платформы развертывания
function resolveJSONataRequest(ID, params) {
    let result = null;
    if (env.isBackendMode()) {
        result = `backend://jsonata/${encodeURIComponent(ID)}`;
        params && (result += `?params=${encodeURIComponent(JSON.stringify(params))}`);
    } else {
        result = queries.makeQuery(queries.QUERIES[ID], params);
    }
    return result;
}

export default {
    driver: jsonataDriver,
    expression(expression, self_, params, isTrace, funcs) {
        return {
            driver: this.driver,
            expOrigin: null,
            onError: null,
            async evaluate(context, def) {
                let result = null;
                try {
                    if (expression.startsWith('backend://')) {
                        const url = new URL(expression);
                        [
                            { field: 'params', value: params},
                            { field: 'subject', value: self_}
                        ].map((param) => {
                            if (!param.value) return;
                            const oldValue = JSON.parse(url.searchParams.get(param.field));
                            const newValue = Object.assign({}, params, oldValue);
                            url.searchParams.set(param.field, JSON.stringify(newValue));
                        });
                        result = (await requests.request(url)).data;
                    } else if (!context && env.isBackendMode()) {
                        let url = `backend://jsonata/${encodeURIComponent(expression)}`;
                        url += `?params=${encodeURIComponent(JSON.stringify(params || null))}`;
                        url += `&subject=${encodeURIComponent(JSON.stringify(self_ || null))}`;
                        result = (await requests.request(url)).data;
                    } else {
                        !this.expOrigin && (this.expOrigin = this.driver.expression(expression, self_, params, isTrace || env.isTraceJSONata(), funcs));
                        result = await this.expOrigin.evaluate(context || window.Vuex.state.manifest || {});
                    }
                } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error(e);
                    throw e;
                }
                return result || def;
            }
        };
    },

    // ********** МЕНЮ *************
    menu() {
        return resolveJSONataRequest(queries.IDS.USER_MENU);
    },

    // ********** КОНТЕКСТЫ *************

    // Запрос по контексту
    context(context) {
        return resolveJSONataRequest(queries.IDS.CONTEXT, { CONTEXT_ID: context });
    },    

    // ********** КОМПОНЕНТЫ *************

    // MindMap по архитектурным компонентам
    archMindMapComponents(root) {
        return resolveJSONataRequest(queries.IDS.MINDMAP_COMPONENTS, { ROOT: root });
    },

    // Запрос по компоненту
    component(component) {
        return resolveJSONataRequest(queries.IDS.COMPONENT, { COMPONENT_ID: component });
    },
    // Запрос контекстов в которых встречается компонент
    contextsForComponent(component) {
        return resolveJSONataRequest(queries.IDS.CONTEXTS_FOR_COMPONENT, { COMPONENT_ID: component });
    },
    // Сводка по компоненту
    summaryForComponent(component) {
        return resolveJSONataRequest(queries.IDS.SUMMARY_FOR_COMPONENT, { COMPONENT_ID: component });
    },
    // Виджеты компонентов
    widgetsForComponent() {
        return resolveJSONataRequest(queries.IDS.WIDGETS_FOR_COMPONENT);
    },
    // Определение размещения манифестов описывающих компонент
    locationsForComponent(component) {
        return resolveJSONataRequest(queries.IDS.COMPONENT_LOCATIONS, { COMPONENT_ID: component });
    },

    // ********** АСПЕКТЫ ***********

    // MindMap по архитектурным аспектам
    archMindMapAspects(root) {
        return resolveJSONataRequest(queries.IDS.MINDMAP_ASPECTS, { ROOT: root || '' });
    },

    // Запрос по аспекту
    aspect(aspect, context) {
        return resolveJSONataRequest(queries.IDS.ASPECT, {
            CONTEXT_ID: context || 'self',
            ASPECT_ID: aspect
        });
    },
    // Сводка по аспекту
    summaryForAspect(aspect) {
        return resolveJSONataRequest(queries.IDS.SUMMARY_ASPECT, { ASPECT_ID: aspect });
    },
    widgetsForAspect() {
        return resolveJSONataRequest(queries.IDS.WIDGETS_FOR_ASPECT);
    },
    defaultContextForAspect(aspect) {
        return resolveJSONataRequest(queries.IDS.DEFAULT_CONTEXT_ASPECT, { ASPECT_ID: aspect });
    },
    // Определение размещения манифестов описывающих аспект
    locationsForAspect(aspect) {
        return resolveJSONataRequest(queries.IDS.ASPECT_LOCATIONS, { ASPECT_ID: aspect });
    },
    // Запрос контекстов в которых встречается аспект
    contextsForAspects(aspect) {
        return resolveJSONataRequest(queries.IDS.CONTEXTS_FOR_ASPECT, { ASPECT_ID: aspect });
    },
    // Запрос компонентов в которых встречается аспект
    componentsForAspects(aspect) {
        return resolveJSONataRequest(queries.IDS.COMPONENTS_FOR_ASPECT, { ASPECT_ID: aspect });
    },

    // ********** ТЕХНОЛОГИИ ***********
    
    // Сбор информации об использованных технологиях
    collectTechnologies() {
        return resolveJSONataRequest(queries.IDS.TECHNOLOGIES);
    },
    // Карточка технологии
    summaryForTechnology(technology) {
        return resolveJSONataRequest(queries.IDS.TECHNOLOGY, { TECH_ID: technology });
    },

    // ********** СУЩНОСТИ ***********
    
    // Документы для сущности
    docsForSubject(entity) {
        return resolveJSONataRequest(queries.IDS.DOCUMENTS_FOR_ENTITY, { ENTITY: entity });
    },

    // Сводная JSONSchema по всем кастомным сущностям
    entitiesJSONSchema() {
        return resolveJSONataRequest(queries.IDS.JSONSCEMA_ENTITIES);
    },

    // Сводная JSONSchema по всем кастомным сущностям
    getObject(id) {
        return resolveJSONataRequest(queries.IDS.GET_OBJECT, { OBJECT_ID: id });
    }
};
