const manifest = require('./package.json');

export default {
    // Адрес универсального сервера авторизации Dochub
    REGISTRY_SERVER: process.env.VUE_APP_DOCHUB_DEV_AUTH_SERVICE || 'https://registry.dochub.info',
    // Адрес публичного API Bitbucket 
    PUBLIC_API_SERVER: 'https://api.bitbucket.org/2.0/',
    // Манифест плагина
    MANIFEST: manifest.dochub
};
