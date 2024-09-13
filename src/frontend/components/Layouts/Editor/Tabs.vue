<template>
  <v-tabs
    v-model="selected"
    class="dochub-editor-tabs"
    background-color="rgb(52, 149, 219)"
    center-active
    align-with-title
    dark>
    <template v-if="tabs.length > 1">
      <v-tab v-for="tab in tabs" :key="tab.documentPath" :title="tab.hint">
        <v-icon v-if="tab.icon" style="margin-right: 8px;">{{ tab.icon }}</v-icon>
        {{ tab.title || '...' }}
        <v-icon v-if="!tab.protected" dark right title="Закрыть" @click.stop="onClose(tab)">mdi-close-box-outline</v-icon>
      </v-tab>
      <v-menu up left>
        <template #activator="{ on, attrs }">
          <v-btn text class="align-self-center mr-4" v-bind="attrs" v-on="on">
            <v-icon style="margin-right: 8px;">mdi-plus</v-icon>
            Создать            
          </v-btn>
        </template>
        <v-list class="grey lighten-3">
          <v-list-item
            v-for="item in addItems"
            :key="item.title"
            @click="onAdd(item)">
            {{ item.title }}
          </v-list-item>
        </v-list>
      </v-menu>
    </template>
  </v-tabs>  
</template>

<script>
  import { DocHub, EditorEvents } from 'dochub-sdk';

  export default {
    name: 'EditorTabs',
    data() {
      return {
        selectedTab: 0,
        portalTab: {
          icon: 'mdi-view-dashboard-outline',
          protected: true,
          path: this.$route.fullPath || '/',
          title: 'Портал'
        }
      };
    },
    computed: {
      addItems() {
        return this.$store.state.plugins.editors.map((item) => ({
          ...item
        }));
      },
      contexts() {
        return this.$store.state.editors.contexts;
      },
      tabs() {
        return [
          this.portalTab,
          ...this.contexts.map((item) => ({
            title: item.title.length > 16 ? `...${item.title.slice(-12)}` : item.title,
            hint: item.title,
            path: `/editor/${item.documentPath.slice(item.documentPath[0] === '/' ? 1 : 0)}`
          }))
        ];
      },
      selected: {
        get() {
          return this.selectedTab;
        },
        set(tabIndex) {
          this.selectedTab = tabIndex;
          this.tabs[tabIndex] && !this.isEqualityPath(this.$router.currentRoute.fullPath, this.tabs[tabIndex]?.path)
            && DocHub.router.navigate(this.tabs[tabIndex].path);
        }
      }
    },
    watch: {
      contexts() {
        const oldPath = this.tabs[this.selectedTab]?.path;
        this.updateSelectedTab();
        oldPath !== this.tabs[this.selectedTab]?.path && DocHub.router.navigate(this.tabs[this.selectedTab]?.path);
      },
      '$route.search'() {
        this.updateSelectedTab();
      },
      '$route.path'() {
        this.updateSelectedTab();
      },
      '$route.fullPath'(fullPath) {
        !fullPath?.startsWith('/editor/') && (this.portalTab.path = fullPath);
      }
    },
    beforeDestroy() {
      DocHub.router.navigate(this.portalTab.path);
    },
    mounted() {
      this.updateSelectedTab();
    },
    methods: {
      onAdd(item) {
        this.$router.push({ path : `/editor/$/${item.type}`, hash: `#${EditorEvents.create}`});
      },
      isEqualityPath(url1 = '/', url2 = '/') {
        const parseURL1 = new URL(url1, window.location.href);
        const parseURL2 = new URL(url2, window.location.href);
        return (parseURL1.pathname === parseURL2.pathname)
          && (
            JSON.stringify(Object.fromEntries(parseURL1.searchParams)) === JSON.stringify(Object.fromEntries(parseURL2.searchParams))
          );
      },
      updateSelectedTab() {
        this.selectedTab = this.tabs.findIndex((item) => this.isEqualityPath(this.$route.fullPath, item.path));
        this.selectedTab = this.selectedTab >= 0 ? this.selectedTab : 0;
      },
      onClose(tab) {
        DocHub.router.navigate(`${tab.path.split('#')[0]}#$close`);
      }
    }
  };
</script>

<style>
.dochub-editor-tabs {
  overflow: auto;
}
.dochub-editor-tabs  .v-tabs-slider-wrapper {
  height: 2px !important;
}

.dochub-editor-tabs .v-tabs-bar {
  height: 32px;
}
</style>
