<template>
  <v-app-bar
    app
    clipped-left
    color="#3495db"
    dark
    v-bind:class="isPrintVersion ? 'print-version' : ''"
    style="z-index: 99">
    <div class="main-layout__header">
      <div class="main-layout__header__menu">
        <v-btn v-if="isBackShow" icon v-on:click="back">
          <v-icon>arrow_back</v-icon>
        </v-btn>
        <v-app-bar-nav-icon v-on:click="() => handleDrawer()">
          <header-logo/>
        </v-app-bar-nav-icon>
        <v-toolbar-title style="cursor: pointer" v-on:click="onLogoClick">DocHub</v-toolbar-title>
      </div>
      <div class="main-layout__header__menu">
        <v-toolbar-title right offset-y style="cursor: pointer" v-on:click="loginout()">{{
            user || 'Login'
          }}
        </v-toolbar-title>
        <v-spacer/>
        <v-btn v-if="isCriticalError" icon title="Есть критические ошибки!" v-on:click="gotoProblems">
          <v-icon class="material-icons blink" style="display: inline">error</v-icon>
        </v-btn>
        <v-btn v-if="isSearchInCode" icon title="Найти в коде" v-on:click="gotoCode">
          <v-icon class="material-icons" style="display: inline">search</v-icon>
        </v-btn>
        <v-menu offset-y>
          <template #activator="{ on, attrs }">
            <v-btn icon v-bind="attrs" v-on="on">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list>
            <v-list-item>
              <v-checkbox v-model="isPrintVersion"/>
              <v-list-item-title>Версия для печати</v-list-item-title>
            </v-list-item>
            <v-list-item>
              <v-list-item-title style="cursor: pointer;" v-on:click="doPrint">Печать</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>
  </v-app-bar>
</template>

<script>
  import env, {Plugins} from '@front/helpers/env';
  import oidcClient from '@front/auth/oidc-client';

  import HeaderLogo from './HeaderLogo';

  export default {
    name: 'Header',
    components: {
      HeaderLogo
    },
    data() {
      return {
        isSearchInCode: env.isPlugin(Plugins.idea),
        isBackShow: env.isPlugin(Plugins.vscode),
        user: null
      };
    },
    computed: {
      isCriticalError() {
        return !!(this.$store.state.problems || []).find((item) => item.critical);
      },
      isPrintVersion: {
        set(value) {
          this.handleDrawer(!value);
          this.$store.commit('setPrintVersion', value);
        },
        get() {
          return this.$store.state.isPrintVersion;
        }
      }
    },
    mounted() {
      window.OidcUserManager.getUser().then(user => {
        const userName = user?.profile?.name;
        this.user = userName ? userName + ' (Logout)' : null;
        if (this.user) {
          window.Vuex.dispatch('reloadRootManifest');
        } else {
          window.Vuex.dispatch('clean');
        }
      });
    },
    methods: {
      doPrint() {
        window.print();
      },
      handleDrawer(value) {
        this.$emit('handleDrawer', value);
      },
      back() {
        this.$router.back();
      },
      gotoProblems() {
        this.$router.push({name: 'problems'}).catch(() => null);
      },
      onLogoClick() {
        this.$router.push({name: 'main'}).catch(() => null);
      },
      gotoCode() {
        // eslint-disable-next-line no-console
        // console.info('For GOTO ', window.location.hash);
        const struct = window.location.hash.split('/');
        switch (struct[1]) {
          case 'entities': {
                             const entity = struct[2];
                             const url = new URL(window.location.hash.slice(1), window.location);
                             const id = url.searchParams.get('id');
                             window.$PAPI.goto(null, entity, id);
                           }
                           break;
          case 'architect': {
            switch (struct[2]) {
              case 'contexts':
                window.$PAPI.goto(null, 'context', struct[3]);
                break;
              case 'aspects':
                window.$PAPI.goto(null, 'aspect', struct[3]);
                break;
              case 'components':
                window.$PAPI.goto(null, 'component', struct[3]);
                break;
            }
            break;
          }
          case 'docs':
            window.$PAPI.goto(null, 'document', struct[2]);
            break;
        }
      },
      loginout() {
        console.log("login/logout");
        this.user ? oidcClient.logout() : oidcClient.login().then(() => {
          window.Vuex.dispatch('setRolesFromToken');
          console.log("call set roles from token");
        });
      }
    }
  };
</script>

<style scoped>

.main-layout__header {
  display: flex;
  justify-content: space-between;
  width: 100%;
}

.main-layout__header__menu {
  display: flex;
  align-items: center;
  gap: 8px;
}

header.print-version {
  position: absolute;
}

@keyframes blink {
  50% {
    opacity: 0.0;
  }
}

.blink {
  color: #A00 !important;
  animation: blink 1s step-start 0s infinite;
}
</style>
