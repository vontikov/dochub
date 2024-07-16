<template>
  <v-form ref="form" v-model="valid" lazy-validation>
    <h2>Расположение корневого манифеста dochub.yaml </h2>

    <v-expansion-panels flat class="expansion-panels">
      <v-expansion-panel>
        <v-expansion-panel-header>
          <v-row>
            <v-icon v-on:click.stop="copyText(uri)" title="Копировать">mdi-content-copy</v-icon>
            <v-icon v-on:click.stop="focusToURIEditor(), pastText((text) => (uri = text) && parseURI(true))" title="Вставить">mdi-content-paste</v-icon>
            <v-text-field
              style="margin-left: 4px; margin-right: 16px;"
              id="urieditor"
              v-model="uri"
              v-bind:rules="[v => !!v || 'Требуется обязательно']"
              label="Полный URI файла"
              v-on:click.stop
              append-icon="mdi-close"
              v-on:click:append="reset"
              required />
          </v-row>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <v-autocomplete
            v-model="protocol"
            v-bind:items="protocolList"
            v-bind:search-input.sync="protocolSearch"
            hide-no-data
            item-text="name"
            single-line      
            label="Протокол"
            item-value="protocol"
            v-bind:rules="[v => !!v || 'Требуется обязательно']"
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

          <v-autocomplete
            v-model="file"
            ref="fileSelector"
            v-bind:loading="filesLoading"
            v-bind:items="fileList"
            v-bind:search-input.sync="fileSearch"
            hide-no-data
            item-text="name"
            single-line      
            label="Корневой манифест"
            v-bind:rules="[v => !!v || 'Требуется обязательно']"
            item-value="name"
            required >
            <template v-slot:item="{ item }">
              <v-icon v-if="item.type === 'dir'">mdi-folder</v-icon>
              <v-icon v-else>mdi-file-code-outline</v-icon>
              <v-list-item-content style="margin-top: 4px; margin-left: 4px;">
                <v-list-item-title v-text="item.name"></v-list-item-title>
              </v-list-item-content>
            </template>           
          </v-autocomplete>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-btn v-bind:disabled="!valid" color="success" class="mr-4" v-on:click="validate">
      Применить
    </v-btn>
    <v-btn class="mr-4" v-on:click="createFile">
      Создать файл
    </v-btn>

    <div v-if="copied" class="copied">
      <span>Скопировано!</span>
    </div>
    
  </v-form>
</template>

<script>
  export default {
    name: 'GitMasterBranch',
    props: {
      status: Object
    },
    mounted() {
      this.reset();
    },
    computed: {
      protocols() {
        const result = [];
        this.status?.gitlab && result.push({ name: 'GitLab', protocol: 'gitlab', status: this.status.gitlab});
        this.status?.github && result.push({ name: 'GitHub', protocol: 'github', status: this.status.github});
        this.reset();
        return result;
      },
      protocolList() {
        const result = [].concat(this.protocols || []);
        if (this.protocolSearch && !result.find((item) => item.protocol === this.protocolSearch?.toLowerCase())) {
          result.unshift({
            protocol: this.protocolSearch,
            name: this.protocolSearch,
            status: {
              api: {
                async fetchRepos() {return [];},
                async fetchBranches() {return [];},
                async fetchFiles() {return [];}
              }
            }
          });
        }
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
      },
      fileList() {
        const result = [].concat(this.files || []);
        if (this.fileSearch && !result.find((item) => item.name === this.fileSearch)) {
          result.unshift({
            name: this.fileSearch
          });
        }
        return result;
      },
      protocolAPI() {
        return this.protocolList.find((item) => item.protocol === this.protocol)?.status?.api;
      },
      currentFile() {
        return this.files?.find((item) => item.name === this.file);
      }
    },
    data() {
      return {
        uri: null,

        valid: true,
        protocol: null,
        protocolSearch: null,
        
        repo: null,
        repos: null,
        repoSearch: null,

        branch: null,
        branches: null,
        branchSearch: null,

        file: null,
        files: null,
        fileSearch: null,
        filesLoading: false,

        copied: null
      };
    },
    watch: {
      protocols() {
        this.parseURI();
      },
      protocol() {
        this.makeURI();
      },
      repo() {
        this.reloadBranches();
        this.makeURI();
      },
      branch() {
        this.reloadFiles();
        this.makeURI();
      },
      fileSearch() {
        this.makeURI();
      },
      uri() {
        this.parseURI();
      },
      protocolAPI() {
        this.reloadAll();
      },
      file() {
        this.currentFile?.type === 'dir' && (this.$refs.fileSelector.isMenuActive = true);
        this.reloadFiles();
      }
    },
    methods: {
      pastText(callback) {
        navigator?.clipboard?.readText().then(callback);
      },
      copyText(text) {
        if (this.copied) clearTimeout(this.copied);
        this.copied = setTimeout(() => this.copied = null, 300);
        navigator?.clipboard?.writeText(text);
      },
      focusToURIEditor() {
        document.getElementById('urieditor')?.focus();
      },
      parseURI() {
        const struct = (this.uri || '').split('@');
        const location = struct[0];
        const params = location.split(':');

        if (this.protocol !== params[0]) {
          this.protocolSearch = params[0];
          this.protocol = this.protocolSearch;
        }

        if (this.repo !== params[1]) {
          this.repoSearch = params[1];
          this.repo = this.repoSearch;
        }

        if (this.branch !== params[2]) {
          this.branchSearch = params[2];
          this.branch = this.branchSearch;
        }

        if (this.file !== struct[1]) {
          this.fileSearch = struct[1];
          this.file = this.fileSearch;
        }

      },
      isFocusURIEditor() {
        return document.activeElement?.id === 'urieditor';
      },
      makeURI() {
        !this.isFocusURIEditor()
          && (this.uri = `${this.protocol || ''}:${this.repo || ''}:${this.branch || ''}@${this.fileSearch || this.file}`);
      },
      reloadAll() {
        this.reloadRepos();
        this.reloadBranches();
        this.reloadFiles();
      },
      reloadRepos() {
        this.branches = null;
        this.repos = null;
        const doit = () => {
          if (!this.protocolAPI) {
            setTimeout(doit, 50);
            return;
          }
          this.protocolAPI?.fetchRepos()
            .then((repos) => {
              this.repos = repos;
            })
            .catch((error) => {
              console.error(error);
            })
            .finally(() => this.repos ||= []);
        };
        doit();
      },
      reloadBranches() {
        this.branches = null;
        const doit = () => {
          if (!this.protocolAPI) {
            setTimeout(doit, 50);
            return;
          }
          this.repo && this.protocolAPI?.fetchBranches(this.repo)
            .then((branches) => {
              this.branches = branches;
            })
            .catch((error) => {
              console.error(error);
            })
            .finally(() => this.branches ||= []);
        };
        doit();
      },
      reloadFiles() {
        //this.files = null;
        this.filesLoading = true;
        const doit = () => {
          if (!this.protocolAPI) {
            setTimeout(doit, 50);
            return;
          }
          const path = (this.file || '').split('/').slice(0, -1).join('/');
          this.branch && this.protocolAPI?.fetchFiles(path, this.branch, this.repo)
            .then((files) => {
              this.files = 
                path.split('/').map((item, index, arr) => ({
                  type: 'dir',
                  name: arr.slice(0, index).join('/') + '/'
                })).concat(files
                  .filter((item) => {
                    const name = item.name.toLowerCase();
                    return item.type === 'dir' || name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.json');
                  })
                  .map((item) => {
                    const name = `${path}${path ? '/' : ''}${item.name}${item.type === 'dir' ? '/' : ''}`;
                    return {
                      ...item,
                      name
                    };
                  })
                  .sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    else if (a.type === 'dir') return -1;
                    else if (b.type === 'dir') return 1;
                    else return 0;
                  })
                );
            })
            .catch((error) => {
              console.error(error);
            })
            .finally(() => {
              this.filesLoading = false;
              this.files ||= [];
            });
        };
        doit();
      },
      validate() {
        this.$refs.form.validate();
      },
      reset() {
        this.uri = DocHub.env.VUE_APP_DOCHUB_ROOT_MANIFEST;
      },
      createFile() {
        
      }
    }
  };
</script>

<style scoped>

.copied {
  width: 200px;
  height: 42px;
  position: fixed;
  bottom: 48px;
  left: 50vw;
  margin-left: -100px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 5px;
  text-align: center;
  color: #333;
  font-size: 16px;
  padding-top: 10px;
  transition: all 0.2s ease-out;
}

.expansion-panels div {
  background-color: rgba(0, 0, 0, 0.0) !important;
}

</style>
