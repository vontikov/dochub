// Модуль реализует наследование
export default {
    // Создает связь потомка и родителя
    makePrototype(parent, child) {
        return (() => {
            let cache = null;

            const allProps = () => {
                if (cache) return cache;
                const result = {};
                for (const propId in child) result[propId] = child;
                for (const propId in parent || {})
                    !result[propId] && (result[propId] = parent);
                return cache = result;
            };
    
            return new Proxy(child, {
                get: (target, propId) => {
                    if (propId === '__parent__') return parent;
                    return allProps()[propId]?.[propId];
                },
                enumerate: () => Object.keys(allProps()),
                iterate: () => Object.keys(allProps()),
                ownKeys: () => Object.keys(allProps()),
                getPropertyNames: () => Object.keys(allProps()),
                getOwnPropertyNames: () => Object.keys(allProps()),
                getOwnPropertyDescriptor: () => ({
                    enumerable: true,
                    configurable: true
                })
            });
        })();
    },

    // section - секция объектов требующих обработки
    expandSection(manifest, sectionId) {
        const section = manifest?.[sectionId] || {};
        for (const key in section) {
            const protoPath = section[key].$prototype;
            if (protoPath) {
                if (section[key].__setPrototype__) section[key].__setPrototype__(sectionId, protoPath);
                else section[key] = this.makePrototype(section[protoPath], section[key]);
            }
        }
    },

    // manifest - манифест
    expandAll(manifest) {
        const sections = Object.keys(manifest?.entities || {});
        sections.push('entities');
        sections.map((sectionId) => this.expandSection(manifest, sectionId));
        return manifest;
    }
};
