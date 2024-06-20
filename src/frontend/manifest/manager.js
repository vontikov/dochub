import cache from '@front/manifest/cache';
import requests from '@front/helpers/requests';
import env from '@front/helpers/env';

import manifestParserV1 from '@global/manifest/parser.mjs';
import manifestParserV2 from '@global/manifest/parser2.mjs';

const manifestParser = env.isBackendMode() ? manifestParserV1 : manifestParserV2;

manifestParser.cache = cache;

manifestParser.reloadManifest = async function(payload) {
  await manifestParser.startLoad();
  if (payload) {
    await (
      async function parserImport(next = 0) {
        if (payload?.length > next) {
          if (payload[next] === env.rootManifest) {
            await manifestParser.clean();
            /* Подключаем базовую метамодель */
            await manifestParser.import(manifestParser.cache.makeURIByBaseURI(env.uriMetamodel, requests.getSourceRoot()));
          }
          await manifestParser.import(payload[next]);
          await parserImport(next + 1);
        }
      }
    )();
  } else {
    await manifestParser.clean();
    if (!env.isPlugin()) {
      // Подключаем метамодель
      await manifestParser.import(manifestParser.cache.makeURIByBaseURI(env.uriMetamodel, requests.getSourceRoot()));

      // Если необходимо, подключаем документацию DocHub
      env.isAppendDocHubDocs
        && await manifestParser.import(manifestParser.cache.makeURIByBaseURI('/documentation/dochub.yaml', requests.getSourceRoot()));

      let rootManifest = env.rootManifest;

      const user = await window.OidcUserManager.getUser();
      if (user && rootManifest?.endsWith('.yaml')) {
        const role = user.profile?.roles?.filter(role => role.startsWith('dh-'))[0];
        if (role) {
          rootManifest = rootManifest.slice(0, -4) + role + '.yaml';
        }
      }

      // Если корневой манифест указан загружаем
      rootManifest
        && await manifestParser.import(manifestParser.cache.makeURIByBaseURI(rootManifest, requests.getSourceRoot()));
    } else {
      /* Подключаем базовую метамодель */
      await manifestParser.import(manifestParser.cache.makeURIByBaseURI(env.uriMetamodel, requests.getSourceRoot()));

      await manifestParser.import(
        manifestParser.cache.makeURIByBaseURI(env.rootManifest, requests.getSourceRoot()));

      manifestParser.loaded = {};
    }
  }
  await manifestParser.checkAwaitedPackages();
  manifestParser.checkLoaded();

  manifestParser.stopLoad();
};

export default manifestParser;
