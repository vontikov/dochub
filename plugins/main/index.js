// Драйверы протокола
import gitlab from './drivers/gitlab';
import github from './drivers/github';
import bitbucket from './drivers/bitbucket';

import avatar from './components/OAuthAvatar.vue';
import branchs from './components/gitlab/BranchSelector.vue';

import MasterBranch from './components/settings/MasterBranch.vue';
import GitHubSettings from './components/github/Settings.vue';
import GitLabSettings from './components/gitlab/Settings.vue';
import bitbucketSettings from './components/bitbucket/Settings.vue';


// Драйверы данных
import json from './providers/json';
import yaml from './providers/yaml';
import xml from './providers/xml';

// Регистрация транспонтрных протоколов 
DocHub.protocols.register('gitlab', gitlab);
DocHub.protocols.register('github', github);
DocHub.protocols.register('bitbucket', bitbucket);

// Регистрация провайдеров данных
DocHub.contentProviders.register('^(json|text/json|application/json|application/ld\\+json)', json);
DocHub.contentProviders.register('^(yaml|text/yaml|application/yaml|application/x\\-yaml)', yaml);
DocHub.contentProviders.register('^(xml|text/xml|application/xml|application/xhtml\\+xml)', xml);

// Регистрация UI элементов
DocHub.ui.register('avatar', branchs);
DocHub.ui.register('avatar', avatar);

// Регистрация UI интерфейсов настроек
DocHub.settings.registerUI(GitLabSettings, 'Интеграции/GitLab', ['git', 'GitLab']);
DocHub.settings.registerUI(GitHubSettings, 'Интеграции/GitHub', ['git', 'GitHub']);
DocHub.settings.registerUI(bitbucketSettings, 'Интеграции/Bitbucket', ['git', 'Bitbucket']);

DocHub.settings.registerUI(MasterBranch, 'Основное/Корневой манифест', ['root', 'корневой манифест', 'dochub.yaml']);
