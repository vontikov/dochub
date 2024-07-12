// Драйверы протокола
import gitlab from './drivers/gitlab';
import github from './drivers/github';
import sources from './drivers/sources';

import avatar from './components/OAuthAvatar.vue';
import branchs from './components/gitlab/BranchSelector.vue';

import gitManager from './components/git_manager/Main.vue';


// Драйверы данных
import json from './providers/json';
import yaml from './providers/yaml';
import xml from './providers/xml';


DocHub.protocols.register('gitlab', gitlab);
DocHub.protocols.register('github', github);
DocHub.protocols.register('dochub-main-drivers-sources', sources);

DocHub.contentProviders.register('^(json|text/json|application/json|application/ld\\+json)', json);
DocHub.contentProviders.register('^(yaml|text/yaml|application/yaml|application/x\\-yaml)', yaml);
DocHub.contentProviders.register('^(xml|text/xml|application/xml|application/xhtml\\+xml)', xml);

DocHub.ui.register('avatar', branchs);
DocHub.ui.register('avatar', avatar);

DocHub.documents.register('main-gitmanager', gitManager);

DocHub.dataLake.mountManifest('dochub-main-drivers-sources:github/manager');
