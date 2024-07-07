import datasets from '@front/helpers/datasets';
import uriTool from '@front/helpers/uri';

const SOURCE_PENDING = 'pending';
const SOURCE_READY = 'ready';
const SOURCE_ERROR = 'error';

export default {
    components: {
        Box: {
            template: `
			<div v-on:contextmenu="onContextMenu">
				<v-alert v-for="error in errors" v-bind:key="error.key" type="error" style="line-height: 18px; overflow-x: auto;">
					Компонент: {{error.componentName}}<br>
					Источник: {{$parent.path}}<br><br>
					Ошибка:
					<div style="background-color:#FDD835; white-space: pre-wrap; padding: 8px; color: #000;" v-html="error.message">
					</div>
				</v-alert>
				<slot v-if="!errors.length"></slot>
			</div>`,

            created: function() {
                this.$parent.$on('appendError', (error, componentName) => {
                    let message = (error?.message || error);
                    if (error.response) {
                        const description = error.response?.data?.error || JSON.stringify(error.response?.data);
                        message = (description ? `<pre>${description}</pre>` : '');
                        if (error.config) {
                            const link = error.config.url.toString();
                            message += `${message}<br><br>URL:<a href="${link}" target="_blank">${link}</a><br><br>`;
                        }
                    }
                    this.errors.push(
                        {
                            key: Date.now(),
                            message: message.slice(0, 1024).toString(),
                            componentName
                        }
                    );
                });
                this.$parent.$on('clearErrors', () => this.errors = []);
            },
            methods: {
                onContextMenu(event) {
                    this.$parent.$emit('showContextMenu', event);
                }
            },
            data() {
                return { errors: [] };
            }
        }
    },
    methods: {
        // Сохраняет состояние отображения документа
        saveState() {
            this.state.scrollY = window.scrollY;
            this.state.scrollX = window.scrollX;
        },
        // Восстанавливает состояние отображение
        loadState() {

            if (this.state.scrollY !== null) {
                window.scroll(this.state.scrollX, this.state.scrollY);
            }
        },
        makeDataLakeID(path) {
            return `("${path.slice(1).split('/').join('"."')}")`;
        },
        doRefresh() {
            this.error = null;
            if (this.source.refreshTimer) clearTimeout(this.source.refreshTimer);
            this.source.refreshTimer = setTimeout(() => this.refresh(), 100);
        },
        refresh() {
            this.sourceRefresh();
        },
        sourceRefresh() {
            return new Promise((success, reject) => {
                this.source.status = SOURCE_PENDING;
                this.source.dataset = null;
                if (this.isTemplate && this.profile?.source) {
                    const sourceBasePath = uriTool.getBaseURIOfPath(`${this.path}/source`) || this.baseURI;
                    this.source.provider.getData(null, this.profile, this.params, sourceBasePath)
                        .then((dataset) => {
                            this.source.dataset = dataset;
                            this.source.status = SOURCE_READY;
                            success(dataset);
                        })
                        .catch((e) => {
                            this.error = e;
                            this.source.status = SOURCE_ERROR;
                            reject(e);
                        })
                        .finally(() => {
                            this.$nextTick(() => this.loadState());
                        });
                } else {
                    success(this.source.dataset = null);
                }
            });
        },
        onChangeSource(changes) {
            if (!changes) return;
            this.saveState();
            for (const pattern of changes) {
                if(this.url.match(pattern)) {
                    this.doRefresh();
                    return;
                }
            }
        },
        showContextMenu(event) {
            event.preventDefault();
            this.menu.show = false;
            this.menu.x = event.clientX;
            this.menu.y = event.clientY;
            this.$nextTick(() => {
                this.menu.show = true;
            });
        }
    },
    computed: {
        id() {
            return this.path.split('/').pop();
        },
        isTemplate() {
            return this.profile?.template;
        },
        baseURI() {
            return uriTool.getBaseURIOfPath(this.path);
        },
        url() {
            const contentBasePath = uriTool.getBaseURIOfPath(`${this.path}/${this.isTemplate ? 'template' : 'source'}`) || this.baseURI;
            let result = this.profile ? uriTool.makeURIByBaseURI(this.profile.template || this.profile.source, contentBasePath).toString() : null;
            if (!result) return null;
            result += result.indexOf('?') > 0 ? '&' : '?';
            result += `id=${this.id}&path=${encodeURI(this.path)}`;
            return result;
        },
        isPrintVersion() {
            return this.toPrint || this.$store.state.isPrintVersion;
        }
    },
    props: {
        // Признак того, что документ встроен в другой документ
        inline: {
            type: Boolean,
            required: true
        },
        // Путь к данным профиля документа
        path: {
            type: String,
            required: true
        },
        // Параметры передающиеся в запросы документа
        params: {
            type: Object,
            required: true
        },
        // Признак рендеринга документа для печати
        toPrint: {
            type: Boolean,
            required: false,
            default: undefined
        },
        // Контекстное меню
        contextMenu: {
            type: Array,
            default() {
                return [];
            }
        },
        // Профиль документа
        profile: {
            type: Object,
            default() {
                return {};
            }
        }
    },
    data() {
        const provider = datasets();
        return {
            error: null,
            state: {
                scrollY: null,
                scrollX: null
            },
            menu: {
                show: false,
                x: 0,
                y: 0
            },
            source: {
                provider,
                status: SOURCE_READY,
                dataset: null,
                refreshTimer: null
            }
        };
    },
    watch: {
        path() { this.doRefresh(); },
        params() { this.doRefresh(); },
        profile() { this.doRefresh(); },
        error(error) {
            if (error) {
                // eslint-disable-next-line no-console
                console.error(error, this.url ? `Ошибка запроса [${this.url}]` : undefined);
                this.$emit('appendError', error, this.$options?.name || 'unknown');
            } else
                this.$emit('clearErrors');
        }
    },
    created() {
        // Следим за обновлением документа
        DocHub.eventBus.$on(DocHub.events.dataLake.reloadManifests, this.onChangeSource);
    },
    destroyed() {
        DocHub.eventBus.$off(DocHub.events.dataLake.reloadManifests, this.onChangeSource);
    },
    mounted() {
        this.$on('showContextMenu', this.showContextMenu);
        this.doRefresh();
    }
};
