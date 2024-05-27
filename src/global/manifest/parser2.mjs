// Обновленная версия парсера со слоистым хранением данных 
// предназначен для максимально быстрого применения изменений
// в манифестах

/* ПРОБЛЕМЫ 
1. Не реализован функционал наследования
2. Пример seaf не работает. Считает, что нет корневого манифеста (зависимости?).
*/

import cache from './services/cache.mjs'; // Сервис управления кэшем
import * as semver from 'semver'; // Управление версиями  

// Кладовка
// https://github.com/douglascrockford/JSON-js


class PackageError extends Error {
	constructor(uri, message) {
		super(message);
		this.name = 'Package';
		this.uri = uri;
	}
}

// Парсер манифестов
const parser = {
    checkLoaded() { return true; },
    checkAwaitedPackages() { return true; },
    // Корневые страницы
    rootLayers: [],
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
        this.rootLayers = [];
        this.layers = [];
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
        this.rebuildLayers();
        this.onReloaded && this.onReloaded(this);
    }
};

//  
// Очищает незадействованные слои в текущей транзакции
parser.cleanLayers = function () {
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
            node = node?.[nodeId];
            typeof node === 'object' && (uri = node.__uri__);
        }
        return uri ? [uri] : [];
    }
});


// Создает управляемый объект
// destination - Объект с которым происходит объединение. Низкий приоритет.
// source - Объект с которым происходит объединение. Высокий приоритет.

function ManifestObject(destination, source, owner) {
    // Если объект уже ранее создан другим слоем, встраиваемся в цепочку
    if (destination) {
        this.__proto__ = destination.__self__;
        // destination.__child__ = this;
    }

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
    // Импорты
    this.imported = [];
    // Объекты манифеста принадлежащие слою
    const objects = [];
    // Данные манифеста
    this.manifest = null;
    this.appendObject = (object) => {
        objects.push(object);
    };
    // Признак участие в транзакции
    this.transaction = parser.transaction;
    // Корневой объект данных
    let rootObject = null;
    Object.defineProperty(this, 'object', {
        enumerable: false,
        configurable: false,
        get: () => {
            return rootObject;
        }
    });

    // Разрешаем зависимости
    const resolveDeps = (manifest, callback, uri) => {
        let unresolved = 0;
        // Обходим задекларированные пакеты в манифесте
        const $package = manifest.$package || {};
        for (const packageId in $package) {
            // Анализируем зависимости
            const deps = manifest.$package[packageId].dependencies || [];
            for (const depId in deps) {
                let package_ = parser.packages[depId];
                // Если требуемый пакет еще не загружен, встаем в ожидание
                if (!semver.satisfies(package_?.version, deps[depId])) {
                    // Если пакет уже подключен но не подходит - валимся в ошибку
                    if (package_?.version) 
                        throw new PackageError(uri, 
                            `Пакет [${packageId}] подключен, но его версия [${package_.version}] не удовлетворяет зависимости [${deps[depId]}].`
                        );
                    // Если пакет не зарегистрирован, создаем запись для ждунов
                    !package_ && (parser.packages[depId] = (package_ = { captives: [] }));
                    package_.captives.push({ version: deps[depId], callback });
                    // Отражаем неразрешенную зависимость
                    ++unresolved;
                }
            }
        }
        // Если неразрешенных зависимостей нет, вызываем обработчик
        return !unresolved;
    };

    // Разрешаем ожидающие зависимости
    const liberationDeps = (manifest, uri) => {
        for (const packageId in manifest?.$package) {
            // Если версия пакета уже подключена кидаем ошибку
            if (parser.packages[packageId]?.version)
                throw new PackageError(uri, 
                    `Конфликт версий пакета [${packageId}].`
                    +` Попытка подключения версии [${package_.version}]`
                    +` при наличии [${parser.packages[packageId].version}].`);

            // Если все хорошо, получаем запись о подключенном пакете
            const package_ = manifest?.$package[packageId];
            // Если ее нет - создаем
            !parser.packages[packageId] && (parser.packages[packageId] = { captives: {} });
                    
            // Устанавливаем версию подключенного пакета
            parser.packages[packageId].version = package_.version;

            // Получаем список неразрешенных зависимостей
            const captives = parser.packages[packageId].captives || {};
            for (const index in captives) {
                const captive = captives[index];
                // Проверяем версию и падаем, если версия не удовлетворяет
                if (semver.satisfies(package_.version, captive.version)) {
                    captive.callback();
                } else
                    throw new PackageError(uri, 
                        `Пакет [${packageId}] подключен, но его версия [${package_.version}] не удовлетворяет зависимости [${captive.version}].`
                    );
            }
            parser.packages[packageId].captives = [];
        }
    };

    // Подключаем импортируемые манифесты
    const imports = () => {
        return new Promise((success, reject) => {
            const imports = this.manifest.imports || [];
            const limit = Math.max(imports.length, this.imported.length);
            let counter = 0; // Счетчик отложенных запросов на загрузку слоев
            if (!limit) {
                success();
                return;
            }
            for (let i = 0; i < limit; i++) {
                const import_ = this.manifest.imports[i];
                let imported_ = this.imported[i];
                const uri = import_ ? cache.makeURIByBaseURI(import_, this.uri) : null;
                if (!uri && imported_) { // Если ресурс вышел из игры очищаем его, но не перестраиваем стек слоев
                    imported_.free();
                } else if (imported_?.uri === !!uri) { // !!!!!!!!!!!!!!!!!!!!
                    const message = `Манифест [${uri}] уже подключен в [${parser.loaded[uri].parent.uri}].`;
                    // eslint-disable-next-line no-console
                    console.warn(message);
                } else if (uri !== imported_?.uri) { // Если слой занят другим манифестом перестраиваем его или создаем новый
                    ++counter;
                    !imported_ && (this.imported[i] = imported_ = new ManifestLayer());
                    imported_
                        .reload(uri)
                        .then(() => !--counter && success())
                        .catch(reject);
                }  // Иначе не трогаем слой

                imported_ && (imported_.transaction = parser.transaction);
            }
        });
    };

    // Монтирует слой в стек
    this.mounted = (parent) => {
        rootObject = createManifestObject(parent?.object, this.manifest, this);
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
                // Сохраняем полученные данные манифеста
                this.manifest = manifest;
                // Проверяем пустой ли манифест
                if (!manifest) {
                    // todo возможно стоит сообщать о том, что подключен пустой манифест
                    success();
                    return;
                }
                // Загружаем все импорты
                imports().then(success).catch(reject);
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
        this.imported.map((item) => item.free());
        this.imported = [];
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
parser.registerError = function (e, uri) {
    const errorPath = `$errors/requests/${new Date().getTime()}`;
    // eslint-disable-next-line no-console
    console.error(e, `Ошибка запроса [${errorPath}:${uri}]`, e);
    if (typeof e === 'string') e = JSON.parse(e);
    let errorType = (() => {
        switch (e.name) {
            case 'YAMLSyntaxError':
            case 'YAMLSemanticError':
                return 'syntax';
            case 'TypeError':
                return 'core';
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

parser.pushRequest = function(uri) {
    let request;
    if (this.onPullSource)
        request = this.onPullSource(uri, '/', this);
    else
        request = this.cache.request(uri, '/');

    return new Promise((success, reject) => {
        request.then((response) => {
            success(response && (typeof response.data === 'object'
                ? response.data
                : JSON.parse(response.data))
            );
        }).catch(reject);
    });
};

// Пересобирает слои из графа страниц
parser.rebuildLayers = function() {
    let level = 0;
    const expandItem = (item) => {
        item.imported.map(expandItem);
        console.info('>>>>>>>>>', item.uri);
        item.mounted(this.layers[level - 1]);
        this.layers[level] = item;
        ++level;
    };
    this.rootLayers.map(expandItem);
    this.manifest = Object.assign({}, this.layers[level - 1]?.object);
};


// Импорт манифеста по идентификатору ресурса
//	uri - идентификатор ресурса
parser.import = async function(uri) {
    try {
        // Создаем руктовую страницу
        const rooLayer = new ManifestLayer();
        // Кладем ее в каталог
        this.rootLayers.push(rooLayer);
        // И запускаем загрузку
        await rooLayer.reload(uri);
        console.info('>>>>>>>>>>', parser.packages);
    } catch (e) {
        this.registerError(e, e?.uri || uri);
    }
};


// Менеджер манифестов
export default parser;

