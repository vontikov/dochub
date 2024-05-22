// Обновленная версия парсера со слоистым хранением данных 
// предназначен для максимально быстрого применения изменений
// в манифестах

// НАСЛЕДОВАНИЕ НУЖНо СДЕЛАТЬ

import cache from './services/cache.mjs'; // Сервис управления кэшем
import * as semver from 'semver'; // Управление версиями  

// Кладовка
// https://github.com/douglascrockford/JSON-js


// Парсер манифестов
const parser = {
    checkLoaded() { return true; },
    checkAwaitedPackages() { return true; },
    // Слои данных 
    layers: [],
    // Пакеты и их зависимости
    packages: {},
    // Номер транзакции
    transaction: 0,
    // Обработчик события запуска парсинга манифеста
    onStartReload: null,
    // Публичный корневой объект манифеста
    manifest: null,
    // Очищает незадействованные слои в текущей транзакции
    cleanLayers() {
        const result = [];
        this.layers.map((layer) => {
            if (layer.transaction === this.transaction) {
                result.push(layer);
            } else layer.free();
        });
    },
    // Очистка состояния
    clean() {
        this.transaction++;
        this.cleanLayers();
        this.packages = {};
    },
    startLoad() {
        // Обновляем счетчик операций
        this.transaction++;
        this.onStartReload && this.onStartReload(this);
    },
    // Возвращает верхний слой
    getTopLayer() {
        return this.layers[this.layers.length - 1];
    },
    stopLoad() {
        this.manifest = Object.assign({}, this.getTopLayer()?.object);
        this.onReloaded && this.onReloaded(this);
    }
};

//  
// Очищает незадействованные слои в текущей транзакции
parser.cleanLayers = function() {
    const result = [];
    this.layers.map((layer) => {
        if (layer.transaction === this.transaction) {
            result.push(layer);
        } else layer.free();
    });
};


parser.mergeMap = new Proxy({}, {
    get(target, path) {
        let node = parser.manifest;
        if (!node || (typeof path !== 'string'))
            return target[path];
        let uri = null;
        const nodes = path.split('/');
        for (const i in nodes) {
            const nodeId = nodes[i];
            if (!nodeId) continue;
            node = node[nodeId];
            typeof node === 'object' && (uri = node.__uri__);
        }
        return uri ? [uri] : [];
    }
});


// Создает управляемый объект
// destination - Объект с которым происходит объединение. Низкий приоритет.
// source - Объект с которым происходит объединение. Высокий приоритет.

function ManifestObject(destination, source, owner) {

    /*
    // Хранит информацию об объекте потомке
    let child = null;
    Object.defineProperty(this, '__child__', {
        enumerable: false,
        configurable: false,
        get: () => {
            return child;
        },
        set: (value) => {
            child = value;
        }
    });

    // Освобождение данных объекта 
    Object.defineProperty(this, 'free', {
        enumerable: false,
        configurable: false,
        get: () => {
            return () => {
                for (const propName in this)
                    delete this[propName];
                child && (child.__proto__ = this.__proto__);
                this.__proto__ = null;
                child = null;
            };
        }
    });
    */

    // Если объект уже ранее создан другим слоем, встраиваемся в цепочку
    if (destination) {
        this.__proto__ = destination.__self__;
        // destination.__child__ = this;
    } else this.__proto__;

    const makeProp = (propName, value, oldValue) => {
        if (Array.isArray(value)) {
            Object.defineProperty(this, propName, {
                enumerable: true,
                configurable: true,
                get: () => {
                    // Конкатенируем массив с уникальными значениями
                    let result = [];
                    if (Array.isArray(oldValue)) {
                        const temp = [];
                        oldValue.map((distItem) => {
                            const distContent = JSON.stringify(distItem);
                            if (!value.find((srcItem, index) => {
                                !temp[index] && (temp[index] = JSON.stringify(srcItem));
                                return distContent === temp[index];
                            })) {
                                result.push(distItem);
                            }
                        });
                        result = value.concat(result);
                    } else {
                        result = value;
                    }
                    return result;
                }
            });
        } else if (typeof value === 'object') {
            Object.defineProperty(this, propName, {
                enumerable: true,
                configurable: true,
                value: createManifestObject(typeof oldValue === 'object' ? oldValue : null, value, owner)
            });
        } else {
            Object.defineProperty(this, propName, {
                enumerable: true,
                configurable: true,
                value
            });
        }
    };

    // создаем свойства слоя
    for (const propName in source) {
        makeProp(propName, source[propName], destination?.[propName]);
    }
    owner.appendObject(this);
}

// Прокси для объектов манифестов
const createManifestObject = (destination, source, owner) => {
    const subject = new ManifestObject(destination, source, owner);

    const allProps = () => {
        const result = [];
        for (const propId in subject) result.push(propId);
        return result;
    };

    return new Proxy(subject, {
        get: (target, propId) => {
            switch (propId) {
                case '__self__': return subject;
                case '__uri__': return owner.uri;
                default: return subject[propId];
            }
        },
        enumerate: () => allProps(),
        iterate: () => allProps(),
        ownKeys: () => allProps(),
        getPropertyNames: () => allProps(),
        getOwnPropertyNames: () => allProps(),
        getOwnPropertyDescriptor: () => ({
            enumerable: true,
            configurable: true
        })
    });
};



// Объект файла манифеста
function ManifestLayer() {
    // Текущий идентификатор ресурса слоя
    this.uri = null;
    // Текущий статус слоя
    this.status = null;
    // Объекты манифеста принадлежащие слою
    const objects = [];
    this.appendObject = (object) => {
        objects.push(object);
    };
    // Признак участие в транзакции
    this.transaction = parser.transaction;
    // Корневой объект слоя
    let rootObject = null;
    Object.defineProperty(this, 'object', {
        enumerable: false,
        configurable: false,
        get: () => {
            return rootObject;
        }
    });

    // Разбираем контент
    const parseContent = (manifest) => {
        // Создаем корневой объект слоя
        rootObject = createManifestObject(parser.getTopLayer()?.object, manifest, this);
    };

    // Разрешаем зависимости
    const resolveDeps = (manifest) => {
        const result = [];
        const deps = manifest.$package?.dependencies || [];
        for (const packageId in deps) {
            let package_ = parser.packages[packageId];
            !package_ && (parser.packages[packageId] = (package_ = { layer: null, captives: {} }));
            if (semver.satisfies(package_.package[packageId]?.version, deps[packageId])) {
                delete package_.captives[this.uri];
            } else {
                package_.captives[this.uri] = () => {
                    parseContent(manifest);
                };
                result.push(packageId);
            }
        }
        return result;
    };

    // Разрешаем зависимости
    const liberationDeps = ($package) => {
        for (const packageId in $package) {
            const captives = parser.packages[packageId]?.captives || [];
            for (const uri in captives) captives[uri]();
        }
    };


    // Импортированные слои
    let imported = [];

    // Подключаем импортируемые манифесты
    const imports = async(manifest, baseURI) => {
        return new Promise((success, reject) => {
            const imports = manifest?.imports || [];
            const limit = Math.max(imports.length, imported.length);
            if (!limit) {
                success();
                return;
            }
            let counter = 0; // Счетчик отложенных запросов на загрузку слоев
            for (let i = 0; i < limit; i++) {
                const import_ = manifest.imports[i];
                let imported_ = imported[i];
                const uri = import_ ? cache.makeURIByBaseURI(import_, baseURI) : null;
                if (!uri && imported_) { // Если ресурс вышел из игры очищаем его, но не перестраиваем стек слоев
                    imported_.free();
                } else if (imported_?.uri === !!uri) { // !!!!!!!!!!!!!!!!!!!!
                    const message = `Манифест [${uri}] уже подключен в [${parser.loaded[uri].parent.uri}].`;
                    // eslint-disable-next-line no-console
                    console.warn(message);
                } else if (uri !== imported_?.uri) { // Если слой занят другим манифестом перестраиваем его или создаем новый
                    // Если последовательность слоев разрушена - отчищаем весь незадействованный стек
                    parser.cleanLayers();
                    // И начинаем строить заново
                    counter++;
                    !imported_ && (imported[i] = new ManifestLayer(this)) 
                        .reload(uri)   // Запускаем загрузку слоя
                        .catch(reject) 
                        .finally(() => !--counter && success()); // Если все слои прогрузились, возвращаемся
                }  // Иначе не трогаем слой

                imported_ && (imported_.transaction = parser.transaction);
            }
        });
    };

    // Загружает слой 
    this.reload = (uri) => {
        return new Promise((success, reject) => {
            // Указываем в рамках какой транзакции преобразование
            this.transaction = parser.transaction;
            // Устанавливаем текущий идентификатор ресурса
            this.uri = uri;

            // Отправляем загрузку манифеста в очередь
            parser.pushRequest(uri).then((manifest) => {
                // Сначала загружаем все импорты
                imports(manifest, uri).then(() => {
                    // Разрешаем зависимости
                    if (!resolveDeps(manifest.$package?.dependencies || []).length) {
                        // Если зависимости разрешены, парсим собственный контент
                        parseContent(manifest);
                        // и выпускаем пленников зависящих от текущего пакета
                        liberationDeps(manifest.$package || {});
                        // Помещаем слой в стек
                        parser.layers.push(this);
                    }
                    // Считаем загрузку выполненной
                    success();
                }).catch(reject);
            }).catch(reject);
        });
    };

    // Освобождает слой от данных
    this.free = () => {
        // Освобождаем данные
        for (const i in this.objects) {
            this.objects[i].free();
            delete this.objects[i];
        }
        this.objects = [];
        // Освобождаем все связанные слои
        imported.map((item) => item.free());
        imported = [];
        // Освобождаем ссылку на ресурс
        this.uri = null;
    };

}

// ************************************************************************
// 				        Обработка ошибок
// ************************************************************************

//Регистрирует ошибку
// e - объект ошибки
// uri - источник ошибки
parser.registerError = function(e, uri) {
    const errorPath = `$errors/requests/${new Date().getTime()}`;
    // eslint-disable-next-line no-console
    console.error(e, `Ошибка запроса [${errorPath}:${uri}]`, e);
    if (typeof e === 'string') e = JSON.parse(e);
    let errorType = (() => {
        switch (e.name) {
            case 'YAMLSyntaxError':
            case 'YAMLSemanticError':
                return 'syntax';
            case 'EntryIsADirectory (FileSystemError)':
                return 'file-system';
            case 'Package':
                return 'package';
            default:
                return 'net';
        }
    })();

    this.onError && this.onError(errorType, {
        uri,
        error: e
    });
},


    // ************************************************************************
    // 				Загрузка контента и разрешение зависимостей
    // ************************************************************************

    // Если обработчик определен, он вызывается при запросе ресурса
    // По умолчанию используется request модуль
    parser.onPullSource = null;

// Очередь запросов
parser.requests = [];

parser.pushRequest = function(uri) {
    const state = {
        uri,
        manifest: null,
        error: null,
        ready: false,
        success: null,
        reject: null
    };

    let request;
    if (this.onPullSource)
        request = this.onPullSource(uri, '/', this);
    else
        request = this.cache.request(uri, '/');

    return new Promise((success, reject) => {
        state.success = success;
        state.reject = reject;
        this.requests.push(state);
        console.info('>>>>> COUNT ', this.requests.length);
        request.then((response) => {
            state.manifest = response && (typeof response.data === 'object'
                ? response.data
                : JSON.parse(response.data));
        })
            .catch((err) => state.error = err)
            .finally(() => {
                state.ready = true;
                this.shiftRequest();
            });
    });
};

parser.shiftRequest = function() {
    for (let state = this.requests[0]; state?.ready; state = this.requests[0]) {
        this.requests.shift();
        if (state.error) {
            this.registerError(state.error, state.uri);
            state.reject(state.error);
        } else {
            state.success(state.manifest);
        }
    }
};


// Импорт манифеста по идентификатору ресурса
//	uri - идентификатор ресурса
parser.import = async function(uri) {
    try {
        await (new ManifestLayer()).reload(uri);
    } catch (e) {
        this.registerError(e, e?.uri || uri);
    }
};


// Менеджер манифестов
export default parser;

