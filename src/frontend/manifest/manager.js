import cache from '@front/manifest/cache';
import requests from '@front/helpers/requests';
import env from '@front/helpers/env';

import manifestParser from '@global/manifest/parser2.mjs';

manifestParser.cache = cache;

// ****************************************************************
//         Монтирование внешних манифестов (от плагинов)
// ****************************************************************

// Подмонтированные манифесты от плагинов
// ПОРЯДОК НЕ ИМЕЕТ ЗНАЧЕНИЯ
manifestParser.mountedSources = {};
manifestParser.mountManifest = async function(uri, online = true) {
  this.mountedSources[uri] = true;
  online && await manifestParser.import(uri);
};

manifestParser.unmountManifest = async function(uri, online = true) {
  delete this.mountedSources[uri];
  online && this.findLayers((layer) => {
    return layer.uri === uri;
  })?.free();
};

// ****************************************************************
//            Метод полного обновления озера данных
// ****************************************************************
manifestParser.reloadManifest = async function() {
  await manifestParser.startLoad();
  await manifestParser.clean();
  if (!env.isPlugin()) {
    // Подключаем метамодель
    await manifestParser.import(manifestParser.cache.makeURIByBaseURI(env.uriMetamodel, requests.getSourceRoot()));

    // Если необходимо, подключаем документацию DocHub
    env.isAppendDocHubDocs
      && await manifestParser.import(manifestParser.cache.makeURIByBaseURI('/documentation/dochub.yaml', requests.getSourceRoot()));

    // Если корневой манифест указан загружаем
    env.rootManifest
      && await manifestParser.import(manifestParser.cache.makeURIByBaseURI(env.rootManifest, requests.getSourceRoot()));
  } else {
    /* Подключаем базовую метамодель */
    await manifestParser.import(manifestParser.cache.makeURIByBaseURI(env.uriMetamodel, requests.getSourceRoot()));

    await manifestParser.import(
      manifestParser.cache.makeURIByBaseURI(env.rootManifest, requests.getSourceRoot()));

    manifestParser.loaded = {};
  }

  // Монтируем манифесты плагинов
  for (const sourceURI in this.mountedSources) {
    await this.mountManifest(sourceURI);
  }

  manifestParser.stopLoad();
};

export default manifestParser;
