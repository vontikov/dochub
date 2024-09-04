<template>
  <settings :driver="driver" name="GitHub" :logo="logo">
    <template #config>
      Интеграция с GitHub не требует настроек, т.к. происходит через специальный сервис 
      <a href="https://registry.dochub.info">https://registry.dochub.info</a>.
    </template>
  </settings>
</template>

<script>
  import settings from '../settings/Integration.vue';
  import settingsMixin from '../mixins/settings';
  import github from '../../drivers/github';

  export default {
    name: 'GitHubSettings',
    components: {
      settings
    },
    mixins: [settingsMixin],
    data() {
      return {};
    },
    computed: {
      driver() {
        return github;
      },
      logo() {
        return this.makeURLDataCode(require('!!raw-loader!../../assets/github-logo.svg').default);
      }
    }
  };
</script>

<style>

.integration-setting-logo {
  width: 32px;
  height: 32px;
}

</style>
