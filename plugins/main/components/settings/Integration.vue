<template>
  <div class="intergarion-setting-profile-list">
    <div style="min-height: 64px">
      <img class="intergarion-setting-logo" :src="logo">
      Интеграция с {{ name }} позволяет использовать его как хранилище архкода со встроенным управлением 
      версями, разграничением доступа и возможностью аудита. Вносимые изменения в репозиторий будут сразу
      отображаться в DocHub.
    </div>
    <h3 class="intergarion-setting-header">Настройки</h3>
    <slot name="config" />
    <template v-if="status[driver]?.isActive">
      <h3 class="intergarion-setting-header">Статус авторизации</h3>
      <div class="intergarion-setting-status">
        <template v-if="status[driver]?.isLogined">
          <v-avatar color="indigo">
            <img v-if="status[driver]?.avatarURL" :src="status[driver]?.avatarURL">
            <v-icon v-else dark>
              mdi-account-circle
            </v-icon>
          </v-avatar>
          <strong> {{ status[driver]?.userName || 'Что-то с авторизацией не так...' }}</strong>
          <br><br>
        </template>
        <slot 
          name="actions"
          :processing="isProcessing"
          :logined="status[driver]?.isLogined"
          :login="login"
          :logout="logout" />
      </div>
    </template>
  </div>
</template>

<script>
  import statusMixin from '../mixins/status';
  import settingsMixin from '../mixins/settings';

  export default {
    name: 'IntegrationSettings',
    mixins: [statusMixin, settingsMixin],
    props: {
      driver: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      logo: {
        type: String,
        required: true
      }
    },
    data() {
      return {
        isProcessing: false
      };
    },
    methods: {
      login() {
        this.isProcessing = true;
        DocHub.eventBus.$emit(`${this.driver}-login`);
      },
      logout() {
        this.isProcessing = true;
        DocHub.eventBus.$emit(`${this.driver}-logout`);
      },
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      refresh() {
        this.isProcessing = false;
      }
    }
  };
</script>

<style>
.intergarion-setting-profile-list {
  width: 100%;
  padding: 8px;
}

.intergarion-setting-status {
  margin-left: 8px;
}

.intergarion-setting-logo {
  float: left;
  margin-right: 16px;
  margin-bottom: 16px;
}

.intergarion-setting-header {
  margin-top: 24px;
  margin-bottom: 8px;
  display: block;
}
</style>


