<template>
  <settings :driver="driver" name="Bitbucket" :logo="logo">
    <template #config>
      <template v-if="isFixedConfig">
        У вас нет прав менять параметры интеграции
      </template>
      <config
        v-else
        :mode="mode"
        :servers="servers"
        :get-fields="getFields"
        :check-integration="checkIntegration"
        :server="settings?.bitbucketServer"
        :username="settings?.bitbucketUsername"
        :personal-token="settings?.bitbucketPersonalToken"
        :instruction-u-r-l="instructionURL"
        @apply="apply" />
    </template>
    <template #actions="{ logined, processing, login, logout }">
      <template v-if="isLogInOut">
        <v-btn v-if="logined" color="primary" :disbaled="!processing" :loading="processing" @click="logout">Выйти</v-btn>
        <v-btn v-else color="primary" :disbaled="!processing" :loading="processing" @click="login">Войти</v-btn>
      </template>
    </template>
  </settings>
</template>

<script>
  import settings from '../settings/Integration.vue';
  import settingsMixin from '../mixins/settings';
  import config from '../settings/Config.vue';
  import axios from 'axios';
  import consts from '../../consts';
  import bitbucket from '../../drivers/bitbucket';
  
  
  export default {
    name: 'BitbucketSettings',
    components: {
      settings,
      config
    },
    mixins: [settingsMixin], //
    data() {
      return {
        settings: null,
        instructionURL: null,
        selMode: null,
        servers: [
          'https://bitbucket.org/'
        ]        
      };
    },
    computed: {
      driver() {
        return bitbucket;
      },
      isFixedConfig() {
        return !!process?.env?.VUE_APP_DOCHUB_BITBUCKET_APP_ID || ((process?.env?.VUE_APP_DOCHUB_BITBUCKET_DISABLE || '').toLowerCase() === 'yes');
      },
      logo() {
        return this.makeURLDataCode(require('!!raw-loader!../../assets/bitbucket-logo.svg').default);
      },
      mode() {
        if (this.settings?.bitbucketDisable) return 'disable';
        else if (this.settings?.bitbucketAuthService) return 'registry';
        else return 'personal_token';
      },
      isLogInOut() {
        return this.selMode === 'registry' || !!process?.env?.VUE_APP_DOCHUB_BITBUCKET_APP_ID;
      }
    },
    mounted() {
      this.refreshSettings();
    },
    methods: {
      getFields(mode) {
        // eslint-disable-next-line no-cond-assign
        return (this.selMode = mode) === 'personal_token' ? 
          (this.instructionURL = 'https://dochub.info') && ['server', 'username', 'personalToken'] 
          : (this.instructionURL = '') || [];
      },
      refreshSettings() {
        this.settings = DocHub.settings.pull(['bitbucketAuthService', 'bitbucketServer', 'bitbucketPersonalToken', 'bitbucketUsername', 'bitbucketDisable']);
      },
      async checkIntegration(config) {
        try {
          if (config.mode === 'registry') {
            await axios({
              method: 'GET',
              url: new URL('/bitbucket/oauth/proxy/hello', consts.REGISTRY_SERVER)
            });
          } else if (config.mode === 'personal_token') {
            const url = new URL(config.server);
            await axios({
              method: 'GET',
              auth: {
                username: config.username,
                password: config.personalToken
              },
              headers:{
                'Accept': 'application/json'
              },
              url: new URL('/2.0/user', `${url.protocol}//api.${url.host}/2.0/`)
            });
          }
          return true;
        } catch(error) {
          // eslint-disable-next-line no-console
          console.error(error);
          return error;
        }
      },
      reloadDatalake() {
        DocHub.eventBus.$off('bitbucket-status-change', this.reloadDatalake);
        DocHub.dataLake.reload();  
      },
      apply(config) {
        const result = {
          bitbucketDisable: false,
          bitbucketAuthService: null,
          bitbucketServer: null,
          bitbucketPersonalToken: null,
          bitbucketUsername: null
        };
        switch (config.mode) {
          case 'disable':
            result.bitbucketDisable = true;
            break;
          case 'registry':
            result.bitbucketAuthService = consts.REGISTRY_SERVER;
            break;
          case 'personal_token':
            result.bitbucketServer = config.server;
            result.bitbucketPersonalToken = config.personalToken;
            result.bitbucketUsername = config.username;
            break;
          default:
            throw new Error(`Undefined driver mode ${config.mode}`);
        }
        DocHub.settings.push(result);
        this.refreshSettings();
        window.DocHub.eventBus.$emit('bitbucket-restart');
        DocHub.eventBus.$on('bitbucket-status-change', this.reloadDatalake);
      }
    }
  };
</script>

<style>

</style>
