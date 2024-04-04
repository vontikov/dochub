<template>
  <div v-bind:style="placeHolderStyle">
    <doc
      v-if="!isParamsInvalid && !refresh"
      v-bind:path="presentationPath"
      v-bind:params="entityParams"
      v-bind:context-menu="toSwitchPres" />
    <v-alert v-if="isParamsInvalid && profileLoaded" type="error" v-bind:value="true" style="white-space: pre-wrap;">
      Сущность: {{ entity }}<br>
      Представление: {{ presentation }}<br>
      {{ isParamsInvalid.name }}:<br>
      {{ isParamsInvalid.error }}
    </v-alert>
  </div>
</template>

<script>
  import ajv from 'ajv';
  const ajv_localize = require('ajv-i18n/localize/ru');

  import doc from '@front/components/Docs/DocHubDoc.vue';
  import query from '@front/manifest/query';

  import { uploadDocument } from './EntityUpload';

  export default {
    name: 'Entity',
    components: {
      doc
    },
    props: {
      entity: {
        type: String,
        default: undefined
      },
      presentation: {
        type: String,
        default: undefined
      },
      params: {
        type: Object,
        default: undefined
      }
    },
    data() {
      return {
        switchedPresentation: null,
        refresh: false,
        profile: null,
        refresher: null,
        profileLoaded: false,
        menu: {
          show: false,
          x : 0,
          y : 0
        },
        minHeight: null
      };
    },
    computed: {
      // Возвращает презентацию с учетом выбора пользователя
      currentPresentation() {
        return this.switchedPresentation || this.presentation;
      },
      // Стиль на время перестройки документа
      placeHolderStyle() {
        return this.minHeight ? { 'min-height': `${this.minHeight}px` } : undefined;
      },
      // Валидируем входящие параметры, если контракт на параметры определен
      isParamsInvalid() {
        return this.isInvalidParamsToPres(this.presProfile?.params);
      },
      // Все доступные презентации сущности для переключения
      toSwitchPres() {
        const items = this.profile?.presentations || {};
        const result = [];
        Object.keys(items).map((id) => {
          if (id === this.currentPresentation) return;
          const schema = items[id].params;
          if (!schema || !this.isInvalidParamsToPres(schema))
            result.push({
              id,
              title: items[id].title || id,
              on: () => this.onSelectedPres(id)
            });
        });
        return result;
      },
      // Получаем профиль представления
      presProfile() {
        return this.profile?.presentations?.[this.presentation] || {};
      },
      // Формируем параметры для документа
      entityParams() {
        return this.params || (this.$route.params && this.$router.currentRoute.query);
      },
      presentationPath() {
        return `${this.entityPath}/presentations/${this.currentPresentation}`;
      },
      entityPath() {
        return `/entities/${this.entity}`;
      }
    },
    watch: {
      entityParams() {
        this.reloadProfile();
      },
      entityPath() {
        this.reloadProfile();
      },
      manifest() {
        this.reloadProfile();
      },
      currentPresentation() {
        this.reloadProfile();
      }
    },
    mounted() {
      this.reloadProfile();
    },
    methods: {
      makeDataLakeID(path) {
        return `("${path.slice(1).split('/').join('"."')}")`;
      },
      // Перезагружает профиль сущности
      reloadProfile() {
        if (this.refresher) clearTimeout(this.refresher);
        this.profileLoaded = false;
        this.refresher = setTimeout(() =>{
          this.switchedPresentation = null;
          const dateLakeId = this.makeDataLakeID(this.entityPath);
          query.expression(dateLakeId).evaluate()
            .then((data) => {
              // Проверяем, что результат запроса не устарел
              if (dateLakeId === this.makeDataLakeID(this.entityPath)) {
                this.profile = data;
                this.profileLoaded = true;
              }
            })
            .catch((e) => this.error = e)
            .finally(() => this.refresher = null);
        } ,100);
      },
      // Принудительное обновление представления
      refreshPres() {
        this.refresh = true;
        this.minHeight = this.$el.clientHeight;
        this.$nextTick(() => this.refresh = false);
      },
      // Проверка схемы презентации на параметры
      isInvalidParamsToPres(schema) {
        if (schema) {
          try {
            const rules = new ajv({ allErrors: true });
            const validator = rules.compile(schema);
            if (validator(this.entityParams)) return false;
            ajv_localize(validator.errors);
            return {
              name: 'Ошибка валидации параметров',
              error: JSON.stringify(validator.errors, null, 4)
            };
          } catch (e) {
            return {
              name: 'Ошибка описания схемы',
              error: e
            };
          }
        } else return false;
      },
      // Выбор альтернативной презентации
      onSelectedPres(presentation) {
        const presProfile = this.profile?.presentations?.[presentation] || {};
        // Если презентация направлена на выгрузку данных, генерируем их без переключения презентации
        if (presProfile.type.toLowerCase() === 'upload') {
          const path = `/entities/${this.entity}/presentations/${presentation}`;
          uploadDocument(presProfile, path, this.entityParams, this.manifest);
        } else { // Иначе переключаем презентацию
          this.switchedPresentation = presentation;
          /*
          this.$router.push({
            path: `/entities/${this.entity}/${presentation}`,
            query: this.$route.query
          });
          */
          this.refreshPres();
        }
      }
    }
  };
</script>
