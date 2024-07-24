import env from '@front/helpers/env';

/**
 * Очень Важно соблюдать порядок!
 *
 * 1. Инициализация параметров env
 * 2. Загрузка основного приложения(компоненты, vue, итп)
 * 3. Инициализация api плагинов
 * 4. Пулл-инициализация зарегистрированных плагинов
 *
 * !! Lazy Loading юзать только через "жадное-жесткое потребление"(eager), отдельные chunk-и не нужны после билда
 *
 * @param processEnv
 */
const init = async(processEnv) => {
  env.dochub = processEnv ?? {};

  const { default: app } = await import(/* webpackMode: "eager" */ './index');

  await import(/* webpackMode: "eager" */ '@front/plugins/core');

  return app;
};

export { init };
