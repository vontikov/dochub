import gateway from './gateway';

let isAppendNativeRoutes = false;

// Добавляем встроенные роуты переходов
function appendNativeRoutes(router) {
    if (isAppendNativeRoutes) return;
    gateway.appendListener('navigate/component', (data) => {
        router.push({ path: `/architect/components/${Object.keys(data)[0]}`});
    });
    
    gateway.appendListener('navigate/document', (data) => {
        router.push({ path: `/docs/${Object.keys(data)[0]}`});
    });
    
    gateway.appendListener('navigate/aspect', (data) => {
        router.push({ path: `/architect/aspects/${Object.keys(data)[0]}`});
    });
    
    gateway.appendListener('navigate/context', (data) => {
        router.push({ path: `/architect/contexts/${Object.keys(data)[0]}`});
    });
    
    gateway.appendListener('navigate/devtool', (data) => {
        router.push({ path: `/devtool/${Object.keys(data)[0]}`});
    });
}

// Добавляем переходы на пользовательские объекты
let actualEntityListeners = [];
function appendCustomRoutes(router) {
    actualEntityListeners.map((listener) => gateway.removeListener(listener.action, listener.call));
    actualEntityListeners = [];
    const entities = (window?.Vuex?.state?.manifest || {})['entities'];
    for (const entityId in entities) {
        const entity = entities[entityId];
        if (!entity.objects) continue;
        const listener = {
            action: `navigate/entity/${entityId}`,
            call: (data) => {
                router.push({ path: `/entity/blank?id=${Object.keys(data)[0]}`});
            }
        };
        gateway.appendListener(listener.action, listener.call);
        actualEntityListeners.push(listener);
    }
}

export default function(router) {
    appendNativeRoutes(router);
    appendCustomRoutes(router);
}
