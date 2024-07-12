<template>
  <v-form ref="form" v-model="valid" lazy-validation>
    <h2>Расположение корневого манифеста dochub.yaml </h2>
    <v-select 
      v-model="protocol"
      v-bind:items="protocols"
      v-bind:rules="[v => !!v || 'Требуется обязательно']"
      label="Источник"
      item-text="name"
      return-object
      single-line      
      required />
    <v-autocomplete
      v-model="repo"
      v-bind:loading="protocol && !repos"
      v-bind:items="repoList"
      v-bind:search-input.sync="repoSearch"
      hide-no-data
      item-text="title"
      single-line      
      label="Репозиторий"
      item-value="ref"
      v-bind:rules="[v => !!v || 'Требуется обязательно']"
      required />
      
    <v-autocomplete
      v-model="branch"
      v-bind:loading="protocol && !repos && !branches"
      v-bind:items="branchList"
      v-bind:search-input.sync="branchSearch"
      hide-no-data
      item-text="name"
      single-line      
      label="Бранч"
      v-bind:rules="[v => !!v || 'Требуется обязательно']"
      item-value="name"
      required />

    <v-text-field
      id="urieditor"
      v-model="uri"
      v-bind:rules="[v => !!v || 'Требуется обязательно']"
      label="Полный URI файла"
      required />

    <v-btn v-bind:disabled="!valid" color="success" class="mr-4" v-on:click="validate">
      Применить
    </v-btn>
    <v-btn class="mr-4" v-on:click="reset">
      Восстановить
    </v-btn>
  </v-form>
</template>

<script>
  export default {
    name: 'GitMasterBranch',
    props: {
      status: Object
    },
    mounted() {
      this.makeURI();
    },
    computed: {
      protocols() {
        const result = [];
        this.status?.gitlab && result.push({ name: 'GitLab', protocol: 'gitlab', status: this.status.gitlab});
        this.status?.github && result.push({ name: 'GitHub', protocol: 'github', status: this.status.github});
        return result;
      },
      repoList() {
        const result = (this.repos || []).map((item) => {
          return {
            ...item,
            title: item.ref === item.name ? item.ref : `${item.ref} (${item.name})`
          };
        });
        if (this.repoSearch && !result.find((item) => item.ref === this.repoSearch)) {
          result.unshift({
            title: this.repoSearch,
            ref: this.repoSearch
          });
        }
        return result;
      },
      branchList() {
        const result = [].concat(this.branches || []);
        if (this.branchSearch && !result.find((item) => item.name === this.branchSearch)) {
          result.unshift({
            name: this.branchSearch
          });
        }
        return result;
      }
    },
    data() {
      return {
        uri: null,

        valid: true,
        protocol: null,
        
        repo: null,
        repos: null,
        repoSearch: null,

        branch: null,
        branches: null,
        branchSearch: null
      };
    },
    watch: {
      protocol(value, oldValue) {
        if (value?.protocol !== oldValue?.protocol) {
          this.branch = null;
          this.repo = null;
          this.reloadRepos();
          this.makeURI();
        }
      },
      repo() {
        this.reloadBranches();
        !this.isFocusURIEditor() && (this.branch = null);
        this.makeURI();
      },
      branch() {
        this.makeURI();
      },
      uri() {
        this.parseURI();
      }
    },
    methods: {
      isFocusURIEditor() {
        return document.activeElement?.id === 'urieditor';
      },
      parseURI() {
        if (this.isFocusURIEditor()) {
          const location = (this.uri || '').split('@')[0];
          const params = location.split(':');
          this.protocol = this.protocols.find((item) => item.protocol === params[0]);
          
          this.repoSearch = params[1];
          this.repo = this.repoSearch;

          this.branchSearch = params[2];
          this.branch = this.branchSearch;
        }
      },
      makeURI() {
        !this.isFocusURIEditor()
          && (this.uri = `${this.protocol?.protocol || '???'}:${this.repo || '???'}:${this.branch || '???'}@dochub.yaml`);
      },
      reloadRepos() {
        this.branches = null;
        this.repos = null;
        this.protocol?.status.api.fetchRepos()
          .then((repos) => {
            this.repos = repos;
          })
          .catch((error) => {
            console.error(error);
          })
          .finally(() => this.repos ||= []);
      },
      reloadBranches() {
        this.branches = null;
        this.repo && this.protocol?.status.api.fetchBranches(this.repo)
          .then((branches) => {
            this.branches = branches;
          })
          .catch((error) => {
            console.error(error);
          })
          .finally(() => this.branches ||= []);
      },
      validate() {
        this.$refs.form.validate();
      },
      reset() {
        this.$refs.form.reset();
      }
    }
  };
</script>

<style scoped>
</style>
