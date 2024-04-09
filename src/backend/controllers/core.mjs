import datasets from '../helpers/datasets.mjs';
import storeManager from '../storage/manager.mjs';
import cache from '../storage/cache.mjs';
import queries from '../../global/jsonata/queries.mjs';
import helpers from './helpers.mjs';
import compression from '../../global/compress/compress.mjs';
import {getRoles} from '../helpers/jwt.mjs';

const compressor = compression();

// const LOG_TAG = 'controller-core';
export default (app) => {

    // Создает ответ на JSONata запрос и при необходимости кэширует ответ
    function makeJSONataQueryResponse(res, query, params, subject, roles) {
        cache.pullFromCache(app.storage.hash, JSON.stringify({ query, params, subject, roles }), async() => {
            let ctx = roles.length === 0 ? app.storage.manifests['default'] : app.storage.manifests[roles];
            return await datasets(app).parseSource(
                ctx,
                query,
                subject,
                params
            );
        }, res);
    }

    // Парсит переданные во внутреннем формате данные 
    function parseRequest(req) {
        return {
            query: req.params.query,
            params: req.query?.params ? JSON.parse(req.query?.params) : undefined,
            subject: req.query?.subject ? JSON.parse(req.query?.subject) : undefined,
            baseURI: req.query?.baseuri
        };
    }

    // Выполняет произвольные запросы 
    app.get('/core/storage/jsonata/:query', function(req, res) {
        if (!helpers.isServiceReady(app, res)) return;

        const roles = getRoles(req.headers);
        app.storage = {...app.storage, roles: [...roles]};
        const request = parseRequest(req);
        const query = (request.query.length === 36) && queries.QUERIES[request.query]
            ? `(${queries.makeQuery(queries.QUERIES[request.query], request.params)})`
            : request.query;

        makeJSONataQueryResponse(res, query, request.params, request.subject, roles);
    });

    // Запрос на обновление манифеста
    app.put('/core/storage/reload', function(req, res) {
        const reloadSecret = req.query.secret;
        if (reloadSecret !== process.env.VUE_APP_DOCHUB_RELOAD_SECRET) {
            res.status(403).json({
                error: `Error reload secret is not valid [${reloadSecret}]`
            });
            return;
        } else {
            app.storage = {...app.storage, manifests: null}
            const oldHash = app.storage.hash;
            storeManager.reloadManifest(app)
                .then((storage) => storeManager.applyManifest(app, storage))
                .then(() => cache.clearCache(oldHash))
                .then(() => res.json({ message: 'success' }));
        }
    });

    // Выполняет произвольные запросы 
    app.get('/core/storage/release-data-profile/:query', async function(req, res) {
        if (!helpers.isServiceReady(app, res)) return;

        const roles = getRoles(req.headers);

            console.log('apppp', app);
            app.storage = {...app.storage, roles: [...roles]};
            console.log('apppp', app);
            const request = parseRequest(req);
            cache.pullFromCache(app.storage.hash, JSON.stringify({
                path: request.query,
                params: request.params,
                roles: roles
            }), async () => {
                if (request.query.startsWith('/'))
                    return await datasets(app).releaseData(request.query, request.params);
                else {
                    let profile = null;
                    const params = request.params;
                    if (request.query.startsWith('{'))
                        profile = JSON.parse(request.query);
                    else
                        profile = JSON.parse(await compressor.decodeBase64(request.query));

                    const ds = datasets(app);
                    if (profile.$base) {
                        const path = ds.pathResolver(profile.$base);
                        if (!path) {
                            res.status(400).json({
                                error: `Error $base location [${profile.$base}]`
                            });
                            return;
                        }
                        return await ds.getData(path.context, profile, params, path.baseURI);
                    } else {
                        return await ds.getData(app.storage.manifest, profile, params);
                    }
                }
            }, res);
    });

    // Возвращает результат работы валидаторов
    app.get('/core/storage/problems/', function(req, res) {
        if (!helpers.isServiceReady(app, res)) return;
        const roles = getRoles(req.headers);
        app.storage = {...app.storage, roles: [...roles]};
        res.json(app.storage.problems || []);
    });
};

