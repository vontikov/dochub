import Doc from '@front/components/Architecture/Document.vue';
import Main from '@front/components/Main';
import Component from '@front/components/Architecture/Component';
import Aspect from '@front/components/Architecture/Aspect';
import Context from '@front/components/Architecture/Context';
import Radar from '@front/components/Techradar/Main';
import Technology from '@front/components/Techradar/Technology';
import Problems from '@front/components/Problems/Problems';
import Empty from '@front/components/Controls/Empty';
import DevTool from '@front/components/JSONata/DevTool';
import Entity from '@front/components/Entities/Entity';
import Settings from '@front/components/settings/main.vue';

const routes = [
  {
    name: 'main',
    path: '/main',
    component: Main
  },
  {
    name: 'home',
    path: '/',
    redirect: { name: 'main' }
  },
  {
    name: 'root',
    path: '/root',
    redirect: { name: 'main' }
  },
  {
    name: 'doc',
    path: '/docs/:document',
    component: Doc
  },
  {
    name: 'contexts',
    path: '/architect/contexts/:context',
    component: Context
  },
  {
    name: 'component',
    path: '/architect/components/:component',
    component: Component
  },
  {
    name: 'aspect',
    path: '/architect/aspects/:aspect',
    component: Aspect
  },
  {
    name: 'radar',
    path: '/techradar',
    component: Radar
  },
  {
    name: 'radar-section',
    path: '/techradar/:section',
    component: Radar
  },
  {
    name: 'technology',
    path: '/technology/:technology',
    component: Technology
  },
  {
    name: 'problems-subj',
    path: '/problems/:subject',
    component: Problems
  },
  {
    name: 'settings',
    path: '/settings',
    component: Settings
  },
  {
    name: 'problems',
    path: '/problems',
    component: Problems
  },
  {
    name: 'devtool_source',
    path: '/devtool/:jsonataSource(.*)',
    component: DevTool
  },
  {
    name: 'devtool',
    path: '/devtool',
    component: DevTool
  },
  {
    name: 'entities',
    path: '/entities/:entity/:presentation',
    component: Entity
  },
  {
    name: 'Empty',
    path: '*',
    component: Empty
  }
];

export default routes;
