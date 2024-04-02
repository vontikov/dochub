// Обеспечивает работу DocHub в кластере
import createRedisClient from '../drivers/redis.mjs';
import logger from '../utils/logger.mjs';

const LOG_TAG = 'cluster-middleware';

const CLUSTER_HASH_KEY = 'DocHub.cluster.hash';

export default async(app, storeManager) => {
    if ((process.env.VUE_APP_DOCHUB_CLUSTER || 'off').toLowerCase() === 'on') {
        const client = await createRedisClient();
        if (!client) {
            const message = 'I can not create a cluster because connecting to Redis is impossible';
            logger.error(message, LOG_TAG);
            throw new Error(message);
        }

        // Устанавливаем в кластере HASH своей загрузки
        client.set(CLUSTER_HASH_KEY, app.storage.hash);
        logger.log(`Hash of cluster updated to [${app.storage?.hash}]`, LOG_TAG);

        // Устанавливаем обработчик события изменения манифеста
        storeManager.onApplyManifest.push(async() => {
            await client.set(CLUSTER_HASH_KEY, app.storage.hash);
        });

        const clusterMiddleware = async function(req, res, next) {
            // Если идет перезагрузка, отдаем 503
            const remoteHash = await client.get(CLUSTER_HASH_KEY) || app.storage?.hash;
            if (remoteHash !== app.storage?.hash) {
                logger.log(`Cluster inconsistency detected. Current hash is [${app.storage?.hash}], remote hash is [${remoteHash}]. Reloading manifest...`, LOG_TAG);
                storeManager.cleanStorage(app);
                storeManager.reloadManifest(app)
                .then(async(storage) => {
                    await storeManager.applyManifest(app, storage);
                    logger.log(`Reloading complete. Current hash is [${app.storage.hash}], remote hash is [${remoteHash}].`, LOG_TAG);
                })
                .catch((err) => {
                    logger.error(err, LOG_TAG);
                });
            }
            next();
        };

        app.use(clusterMiddleware);
    }
};
