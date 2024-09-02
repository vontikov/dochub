<template>
  <v-form ref="form" v-model="valid" lazy-validation>
    <template v-if="protocols.length">
      <v-expansion-panels flat class="expansion-panels">
        <v-expansion-panel>
          <v-expansion-panel-header>
            <v-row>
              <v-icon title="Копировать" @click.stop="copyText(uri)">mdi-content-copy</v-icon>
              <v-icon title="Вставить" @click.stop="focusToURIEditor(), pastText((text) => pasteURL(text) && parseURI(true))">mdi-content-paste</v-icon>
              <v-text-field
                id="urieditor"
                v-model="uri"
                style="margin-left: 4px; margin-right: 16px;"
                :rules="[v => checkURI(v) || 'Неверный формат URI']"
                label="Полный URI файла"
                append-icon="mdi-close"
                required
                @click.stop
                @click:append="reset" />
            </v-row>
          </v-expansion-panel-header>
          <v-expansion-panel-content>
            <v-autocomplete
              v-model="protocol"
              :items="protocolList"
              :search-input.sync="protocolSearch"
              hide-no-data
              item-text="name"
              single-line      
              label="Протокол"
              item-value="protocol"
              persistent-hint
              hint="Источник кода"
              :rules="[v => !!v || 'Требуется обязательно']"
              required>
              <template v-if="protocolObject?.virtual" #append-outer>
                <v-icon color="warning" title="Недоступно! Выберите доступный вариант из списка.">mdi-alert</v-icon>
              </template>
              <template #item="data">
                <span v-if="data.item.virtual" class="item-virtual">{{ data.item.name }} (недоступно)</span>
                <span v-else>{{ data.item.name }}</span>
              </template>              
            </v-autocomplete>
  
            <v-autocomplete
              v-model="repo"
              :loading="protocol && !repos"
              :items="repoList"
              :search-input.sync="repoSearch"
              hide-no-data
              item-text="title"
              single-line      
              label="Репозиторий"
              persistent-hint
              hint="Репозиторий"
              item-value="ref"
              :rules="[v => !!v || 'Требуется обязательно']"
              append-icon="mdi-reload"
              required 
              @click:append="reloadRepos">
              <template v-if="repoObject?.virtual" #append-outer>
                <v-icon color="warning" title="Недоступно! Выберите доступный вариант из списка.">mdi-alert</v-icon>
              </template>
              <template #item="data">
                <span v-if="data.item.virtual" class="item-virtual">{{ data.item.title }} (недоступно)</span>
                <span v-else>{{ data.item.title }}</span>
              </template>              
            </v-autocomplete>
  
            <v-autocomplete
              v-model="branch"
              :loading="protocol && !repos && !branches"
              :items="branchList"
              :search-input.sync="branchSearch"
              hide-no-data
              item-text="name"
              single-line      
              label="Бранч"
              persistent-hint
              hint="Бранч/ветка в репозитории"
              :rules="[v => !!v || 'Требуется обязательно']"
              item-value="name"
              append-icon="mdi-reload"
              required 
              @click:append="reloadBranches">        
              <template v-if="branchObject?.virtual" #append-outer>
                <v-icon color="warning" title="Недоступно! Выберите доступный вариант из списка.">mdi-alert</v-icon>
              </template>
              <template #item="data">
                <span v-if="data.item.virtual" class="item-virtual">{{ data.item.name }} (недоступно)</span>
                <span v-else>{{ data.item.name }}</span>
              </template>              
            </v-autocomplete>
  
            <v-autocomplete
              ref="fileSelector"
              v-model="file"
              :loading="filesLoading"
              :items="fileList"
              :search-input.sync="fileSearch"
              hide-no-data
              item-text="name"
              single-line      
              label="Корневой манифест"
              persistent-hint
              hint="Корневой манифест"
              :rules="[v => !!v || 'Требуется обязательно']"
              item-value="name"
              append-icon="mdi-reload"
              required 
              @click:append="reloadFiles">
              <template v-if="fileObject?.virtual" #append-outer>
                <v-icon color="warning" title="Недоступно! Выберите доступный вариант из списка.">mdi-alert</v-icon>
              </template>
              <template #item="{ item }">
                <v-icon v-if="item.type === 'dir'">mdi-folder</v-icon>
                <v-icon v-else>mdi-file-code-outline</v-icon>
                <v-list-item-content style="margin-top: 4px; margin-left: 4px;">
                  <v-list-item-title v-if="item.virtual" class="item-virtual">{{ item.name }} (недоступно)</v-list-item-title>
                  <v-list-item-title v-else>{{ item.name }}</v-list-item-title>
                </v-list-item-content>
              </template>           
            </v-autocomplete>
          </v-expansion-panel-content>
        </v-expansion-panel>
      </v-expansion-panels>
  
      <v-btn
        v-if="!contentLoading"
        :disabled="!valid"
        color="primary"
        class="mr-4"
        @click="apply">
        Применить
      </v-btn>
      <v-btn 
        v-if="!contentLoading && rootNotFound"
        :disabled="!valid"
        class="mr-4"
        @click="createFile">
        Создать файл
      </v-btn>
      <v-progress-circular v-else-if="contentLoading" size="32" width="7" value="60" color="primary" indeterminate />
  
      <div v-if="copied" class="copied">
        <span>Скопировано!</span>
      </div>
    </template>
    <template v-else>
      Нет ни одного источника для выбора корневого манифеста.
    </template>
  </v-form>
</template>
  
  <script>
  import statusMixin from '../mixins/status';

  export default {
    name: 'GitMasterBranch',
    mixins: [statusMixin],
    data() {
      return {
        uri: null,
  
        valid: true,
        protocol: null,
        protocolSearch: null,
          
        repo: null,
        repos: null,
        repoSearch: null,
        repoError: null,
  
        branch: null,
        branches: null,
        branchSearch: null,
        branchError: null,
  
        file: null,
        files: null,
        fileSearch: null,
        filesLoading: false,
        filesError: null,
          
        contentLoading: null,
        contentURI: null,
        content: null,
        rootNotFound: false,
        contentError: null,
  
        copied: null
      };
    },
    computed: {
      protocols() {
        const result = [];
        this.status?.gitlab?.isLogined && result.push({ name: 'GitLab', protocol: 'gitlab', status: this.status.gitlab});
        this.status?.github?.isLogined && result.push({ name: 'GitHub', protocol: 'github', status: this.status.github});
        this.status?.bitbucket?.isLogined && result.push({ name: 'Bitbucket', protocol: 'bitbucket', status: this.status.bitbucket});
        return result;
      },
      protocolObject() {
        return this.protocolList?.find((item) => item.protocol === this.protocol);
      },
      protocolList() {
        const result = [].concat(this.protocols || []);
        if (this.protocolSearch && !result.find((item) => item.protocol === this.protocolSearch?.toLowerCase())) {
          result.unshift({
            protocol: this.protocolSearch,
            name: this.protocolSearch,
            virtual: true,
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
      repoObject() {
        return this.repoList?.find((item) => item.ref === this.repo);
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
      branchObject() {
        return this.branchList?.find((item) => item.name === this.branch);
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
      fileObject() {
        return this.fileList?.find((item) => item.name === this.file);
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
        this.reloadFiles();
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
              this.repoError = null;
            })
            .catch((error) => {
              this.repoError = error;
              // eslint-disable-next-line no-console
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
              this.branchError = null;
            })
            .catch((error) => {
              this.branchError = error;
              // eslint-disable-next-line no-console
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
              this.filesError = null;
            })
            .catch((error) => {
              this.filesError = error;
              this.files = [];
              // eslint-disable-next-line no-console
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
                this.contentError = null;
              })
              .catch((error) => {
                this.rootNotFound = error.response?.status === 404;
                if (!this.rootNotFound) {
                  this.contentError = error;
                  // eslint-disable-next-line no-console
                  console.error(error);
                }
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
    color: rgba(0, 0, 0, 0.2); /*chocolate*/
  }
  
  </style>
