import env from '@front/helpers/env';
import { create } from '../core/store';
import { get, add, put } from '../core/data';

import config from './config.json';
import { TCacheData } from '../types/idb.types';

async function storeName() {
  const user = await window['OidcUserManager'].getUser();
  // eslint-disable-next-line no-console
  console.log(user?.profile?.roles);

  return env.rootManifest || 'dochub';
}

const init = async function(): Promise<IDBObjectStore> {
  const _storeName = await storeName();
  return await create({
    ...config,
    storeName: _storeName,
    version: config['version']
  });
};

const getData = async function(id: string): Promise<TCacheData> {
  const _storeName = await storeName();
  return await get({
    storeName: _storeName,
    dbName: config.dbName,
    indexName: config.indexes[0].name,
    value: id
  });
};

const setData = async function(data: TCacheData): Promise<string | number> {
  const _storeName = await storeName();
  return await add(
    config.dbName,
    _storeName,
    data
  );
};

const putData = async function(data: TCacheData): Promise<string | number> {
  const _storeName = await storeName();
  return await put(
    config.dbName,
    _storeName,
    data
  );
};

export {
  init,
  getData,
  setData,
  putData
};
