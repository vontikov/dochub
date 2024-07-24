<template>
  <v-form ref="form" v-model="valid" lazy-validation>
    <h2>Расположение корневого манифеста</h2>

    <v-expansion-panels flat class="expansion-panels">
      <v-expansion-panel>
        <v-expansion-panel-header>
          <v-row>
            <v-icon title="Копировать" v-on:click.stop="copyText(uri)">mdi-content-copy</v-icon>
            <v-icon title="Вставить" v-on:click.stop="focusToURIEditor(), pastText((text) => pasteURL(text) && parseURI(true))">mdi-content-paste</v-icon>
            <v-text-field
              id="urieditor"
              v-model="uri"
              style="margin-left: 4px; margin-right: 16px;"
              v-bind:rules="[v => checkURI(v) || 'Неверный формат URI']"
              label="Полный URI файла"
              append-icon="mdi-close"
              required
              v-on:click.stop
              v-on:click:append="reset" />
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
            append-icon="mdi-reload"
            required 
            v-on:click:append="reloadRepos" />

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
            append-icon="mdi-reload"
            required 
            v-on:click:append="reloadBranches" />        

          <v-autocomplete
            ref="fileSelector"
            v-model="file"
            v-bind:loading="filesLoading"
            v-bind:items="fileList"
            v-bind:search-input.sync="fileSearch"
            hide-no-data
            item-text="name"
            single-line      
            label="Корневой манифест"
            v-bind:rules="[v => !!v || 'Требуется обязательно']"
            item-value="name"
            append-icon="mdi-reload"
            required 
            v-on:click:append="reloadFiles">
            <template #item="{ item }">
              <v-icon v-if="item.type === 'dir'">mdi-folder</v-icon>
              <v-icon v-else>mdi-file-code-outline</v-icon>
              <v-list-item-content style="margin-top: 4px; margin-left: 4px;">
                <v-list-item-title v-bind:class="item.virtual ? 'item-virtual' : ''" v-text="item.name" />
              </v-list-item-content>
            </template>           
          </v-autocomplete>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>

    <v-btn
      v-if="!contentLoading"
      v-bind:disabled="!valid"
      color="success"
      class="mr-4"
      v-on:click="apply">
      Применить
    </v-btn>
    <v-btn 
      v-if="!contentLoading && rootNotFound"
      v-bind:disabled="!valid"
      class="mr-4"
      v-on:click="createFile">
      Создать файл
    </v-btn>
    <v-progress-circular v-else-if="contentLoading" size="32" width="7" value="60" color="primary" indeterminate />

    <div v-if="copied" class="copied">
      <span>Скопировано!</span>
    </div>
  </v-form>
</template>

<script>
  export default {
    name: 'GitMasterBranch',
    props: {
      status: {
        type: Object,
        required: true
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
        
        contentLoading: null,
        contentURI: null,
        content: null,
        rootNotFound: false,

        copied: null
      };
    },
    computed: {
      protocols() {
        const result = [];
        this.status?.gitlab && result.push({ name: 'GitLab', protocol: 'gitlab', status: this.status.gitlab});
        this.status?.github && result.push({ name: 'GitHub', protocol: 'github', status: this.status.github});
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
                async fetchRepos() {return []; },
                async fetchBranches() {return []; },
                async fetchFiles() {return []; },
                async getContent() { throw 'Is is fake method'; }
              }
            }
          });
        }
        return result;
      },

      repoList() {
        const result = (this.repos || []).map((item) => {
          const title = item.full_name || item.name;
          return {
            ...item,
            title: item.ref === title ? item.ref : `${item.ref} (${title})`
          };
        });
        if (this.repoSearch && !result.find((item) => item.ref === this.repo)) {
          result.unshift({
            virtual: true,
            title: this.repoSearch,
            ref: this.repo
          });
        }
        return result;
      },
      branchList() {
        const result = [].concat(this.branches || []);
        if (this.branchSearch && !result.find((item) => item.name === this.branchSearch)) {
          result.unshift({
            virtual: true,
            name: this.branchSearch
          });
        }
        return result;
      },
      fileList() {
        const result = [].concat(this.files || []);
        if (this.fileSearch && !result.find((item) => item.name === this.fileSearch)) {
          result.unshift({
            virtual: true,
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
      },
      repoId() {
        return (this.repo || '').split('/').pop();
      }
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
        this.rootNotFound = false;
        this.parseURI();
        this.reloadRootManifest();
      },
      protocolAPI() {
        this.reloadAll();
        this.reloadRootManifest();
      },
      file() {
        this.currentFile?.type === 'dir' && (this.$refs.fileSelector.isMenuActive = true);
        this.reloadFiles();
      }
    },
    mounted() {
      this.reset();
      window.addEventListener('paste', this.onPasteURL);
    },
    unmounted() {
      window.removeEventListener('paste', this.onPasteURL);
    },
    methods: {
      pasteURL(url) {
        let result = null;
        for(const protocol of this.protocolList) {
          result = protocol.status?.api?.convertURL && protocol.status.api.convertURL(url);
          if (result) break;
        }
        if (result) {
          this.uri = result;
          return result;
        }
        return null;
      },
      onPasteURL(event) {
        if (event.target.id === 'urieditor') {
          if (this.pasteURL((event.clipboardData || window.clipboardData).getData('text/plain')))
            event.preventDefault();
        }
      },
      checkURI(uri) {
        // eslint-disable-next-line no-useless-escape
        return !!((uri || '').match(/^([a-zA-Z0-9-_]{1,}\:){1}([a-zA-Z0-9-_\/]{1,}\:){1}([a-zA-Z0-9-_]{1,}\@){1}.{1,}$/));
      },
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
          this.repo && this.protocolAPI?.fetchBranches(this.repoId)
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
          this.branch && this.protocolAPI?.fetchFiles(path, this.branch, this.repoId)
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
      reloadRootManifest() {
        if(this.contentURI !== this.uri){
          if (this.contentLoading) clearTimeout(this.contentLoading);
          this.contentURI = this.uri;
          this.contentLoading = setTimeout(() => {
            this.protocolAPI?.getContent(this.uri)
              .then(() => {
                this.rootNotFound = false;
              })
              .catch((error) => {
                this.rootNotFound = error.response?.status === 404;
                console.error(error);
              })
              .finally(() => {
                this.contentLoading = null;
              });
          }, 300);          
        } 
      },
      apply() {
        if(this.$refs.form.validate()) {
          DocHub.settings.push({
            rootManifest: this.uri
          });
        }
      },
      reset() {
        this.uri = DocHub.settings.pull(['rootManifest']).rootManifest;
        this.reloadRootManifest();
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

.item-virtual {
  color: rgba(0, 0, 0, 0.2);
}

</style>
