<template>
  <v-avatar v-if="isActive" color="indigo" style="cursor: pointer;">
    <img v-if="avatarURL" v-bind:src="avatarURL" v-on:click="onMenu">
    <v-icon dark v-else v-on:click="onMenu">
      mdi-account-circle
    </v-icon>
    <v-menu bottom right v-model="showMenu" v-bind:position-x="x" v-bind:position-y="y">
      <v-list>
        <v-list-item v-for="(action, index) in actions" v-bind:key="index" link v-on:click="action.click">
          <v-list-item-avatar v-if="action.icon">
            <img class="logo" v-bind:src="action.icon" v-bind:style="action.style">
          </v-list-item-avatar>
          <v-list-item-title>{{ action.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <template v-if="isProcessing">
      <div class="shadow" />
      <div 
        v-html="`
          <style>
            .v-navigation-drawer--clipped {
              z-index: 6 !important;
            }
          </style>
      `" />
      <v-progress-circular
        size="64"
        width="7"
        style="left: 50%; top: 50vh; position: fixed; margin-left: -32px; margin-top: -32px;"
        value="60"
        color="primary"
        indeterminate />
    </template>    
  </v-avatar>
</template>

<script>

  import statusMixin from './mixins/status';

  export default {
    name: 'OAuthAvatar',
    mixins: [statusMixin],
    data() {
      return {
        showMenu: false,
        x: 0,
        y: 0,
        actions: []
      };
    },
    computed: {
      avatarURL() {
        return this.actions.find((item) => item.status.isLogined && item.status.avatarURL)?.status.avatarURL;
      },
      isActive() {
        return !!this.actions.find((item) => item.status?.isActive);
      }
    },
    methods: {
      makeURLDataCode(source) {
        const base64 = btoa(unescape(encodeURIComponent(source)));
        const encoded = `data:image/svg+xml;base64,${base64}`;
        return encoded;
      },
      refresh() {
        this.actions = [];
        this.status.gitlab?.isActive && this.actions.push({
          status: this.status.gitlab,
          title: this.status.gitlab.isLogined ? 'Выйти' : 'Войти',
          icon: this.makeURLDataCode(require('!!raw-loader!../assets/gitlab-logo.svg').default),
          style: 'width: 64px; height: 64px;',
          click: () => {
            this.isProcessing = true;
            DocHub.eventBus.$emit(
              this.status.gitlab.isLogined
                ? 'gitlab-logout'
                : 'gitlab-login'
            );
          }
        });
        this.status.github?.isActive && this.actions.push({
          status: this.status.github,
          title: this.status.github.isLogined ? 'Выйти' : 'Войти',
          icon: this.makeURLDataCode(require('!!raw-loader!../assets/github-logo.svg').default),
          style: 'width: 32px; height: 32px;',
          click: () => {
            this.isProcessing = true;
            DocHub.eventBus.$emit(
              this.status.github.isLogined
                ? 'github-logout'
                : 'github-login'
            );
          }
        });
        this.isProcessing = false;
      },
      onMenu(e) {
        this.menu = true;
        e.preventDefault();
        const rect = e.target.getBoundingClientRect();
        this.showMenu = false;
        this.x = rect.left;
        this.y = rect.top + rect.height;
        this.$nextTick(() => {
          this.showMenu = true;
        });
      },
      // Обновляем информацию о профайле пользователя
      refreshProfile(status) {
        // status = status || this.status;
        console.info('Gitlab status: ', status);
      }
    }
  };
</script>

<style scoped>

.shadow {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
  background: #000;
  opacity: .3;
}
</style>

