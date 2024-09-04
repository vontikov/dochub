<template>
  <settings :driver="driver" name="GitLab" :logo="logo">
    <template #config>
      <template v-if="isFixedConfig">
        У вас нет прав менять параметры интеграции
      </template>
      <config 
        v-else
        :mode="mode"
        :server="settings?.gitlabServer"
        :servers="servers"
        :personal-token="settings?.gitlabPersonalToken"
        :check-integration="checkIntegration"
        @apply="apply" />
    </template>
    <template #actions="{ logined, processing, login, logout }">
      <v-btn v-if="logined" color="primary" :disbaled="!processing" :loading="processing" @click="logout">Выйти</v-btn>
      <v-btn v-else color="primary" :disbaled="!processing" :loading="processing" @click="login">Войти</v-btn>
    </template>
  </settings>
</template>

<script>
  import axios from 'axios';
  import settings from '../settings/Integration.vue';
  import config from '../settings/Config.vue';
  import settingsMixin from '../mixins/settings';
  import consts from '../../consts';
  import gitlab from '../../drivers/gitlab';

  export default {
    name: 'GitHubSettings',
    components: {
      settings,
      config
    },
    mixins: [settingsMixin],
    data() {
      return {
        settings: null,
        servers: ['https://gitlab.com/']
      };
    },
    computed: {
      driver() {
        return gitlab;
      },
      isFixedConfig() {
        return !!process?.env?.VUE_APP_DOCHUB_GITLAB_APP_ID;
      },
      mode() {
        return this.settings?.gitlabAuthService ? 'registry' : 'personal_token';
      },
      logo() {
        return this.makeURLDataCode(require('!!raw-loader!../../assets/gitlab-logo.svg').default);
      }
    },
    mounted() {
      this.refreshSettings();
    },
    methods: {
      refreshSettings() {
        this.settings = DocHub.settings.pull(['gitlabAuthService', 'gitlabServer', 'gitlabPersonalToken']);
      },
      async checkIntegration(config) {
        try {
          if (config.mode === 'registry') {
            await axios({
              method: 'GET',
              url: new URL('/gitlab/oauth/proxy/hello', consts.REGISTRY_SERVER)
            });
          } else if (config.mode === 'personal_token') {
            await axios({
              method: 'GET',
              headers:{
                'Authorization': `Bearer ${config.personalToken}`  // Токен авторизации
              },
              url: new URL('/api/v4/user', config.server)
            });
          }
          return true;
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error(error);
          return error;
        }
      },
      apply(config) {
        DocHub.settings.push({
          gitlabAuthService: config.mode === 'registry' ? consts.REGISTRY_SERVER : null,
          gitlabServer: config.server,
          gitlabPersonalToken: config.personalToken
        });
        this.refreshSettings();
        window.DocHub.eventBus.$emit('gitlab-restart');
      }
    }
  };
</script>

<style>

.intergarion-setting-logo {
  width: 64px;
  height: 64px;
}

</style>
