<template>
  <v-form ref="form" v-model="valid" :disabled="isSettingDisabled">
    <v-combobox 
      v-model="selMode"
      style="margin-bottom: 24px;"
      persistent-hint
      item-text="name"
      label="Режим авторизации"
      :hint="selMode?.hint"
      :items="modes"
      :rules="rules.mode"
      required>
      <template #item="{ item }">
        {{ item.name }}
      </template>        
    </v-combobox>
    <div v-if="instructionURL" style="margin-bottom: 24px; margin-top: -24px;">
      <a :href="instructionURL" target="blank_">Инструкция по интеграции</a>
    </div>
    <div v-for="field in fields" :key="field">
      <v-combobox
        v-if="field === 'server'"
        v-model="selServer"
        persistent-hint
        :items="servers"
        label="Адрес сервера"
        :rules="rules.server" />
      <v-text-field
        v-else-if="field === 'personalToken'"
        v-model="selPersonalToken"
        :rules="rules.personalToken"
        :type="showPersonalToken ? 'text' : 'password'"
        label="Персональный токен"
        :append-icon="showPersonalToken ? 'mdi-eye' : 'mdi-eye-off'"
        required
        @click:append="showPersonalToken = !showPersonalToken" />
      <v-text-field
        v-else-if="field === 'username'"
        v-model="selUsername"
        :rules="rules.username"
        label="Пользователь"
        required />
    </div>
    <v-alert v-if="checkError" dense outlined type="error">
      {{ checkError }}
    </v-alert>
    <v-btn
      v-if="!isSettingDisabled"
      :disabled="!isChanged || !valid"
      color="success"
      class="mr-4"
      @click="validate">
      Применить
    </v-btn>
    <v-btn
      v-if="!isSettingDisabled && isChanged"
      color="blue-grey"
      class="ma-2 white--text"
      @click="reset">
      Сбросить
    </v-btn>
  </v-form>
</template>

<script>
  import settingsMixin from '../mixins/settings';

  export default {
    name: 'GitHubIntegrationConfig',
    mixins: [settingsMixin],
    props: {
      mode: {
        type: String,
        required: true
      },
      server: {
        type: String,
        default: ''
      },
      personalToken: {
        type: String,
        default: ''
      },
      username: {
        type: String,
        default: ''
      },
      getFields: {
        type: Function,
        default: () => []
      },
      servers: {
        type: Array,
        default() {
          return [];
        }
      },
      checkIntegration: {
        type: Function,
        required: true
      },
      instructionURL: {
        type: String,
        default: ''
      }
    },
    data() {
      return {
        isSettingDisabled: false,
        isProcessing: false,
        valid: false,
        mode_: null,
        personalToken_: '',
        server_: '',
        username_: '',
        checkError: null,
        showPersonalToken: false,
        rules: {
          server: [
            v => !!v || 'Укажите адрес сервера.'
          ],
          mode: [
            v => !!v || 'Выберите режим авторизации, если хотите использовать интеграцию.'
          ],
          username: [
            v => !!v || 'Укажите идентификатор пользователя.'
          ],
          personalToken: [
            v => !!v || 'Для данного режима персональный токен обязателен'
          ]
        },
        modes: [
          {
            name: 'Отключено',
            id: 'disable',
            hint: 'Интеграция отключена.'
          },
          {
            name: 'DocHub Registry',
            id: 'registry',
            hint: 'Сервис авторизации DocHub для доступа к облачным репозиториям. Не требует настройки.'
          },
          {
            name: 'Персональный токен',
            id: 'personal_token',
            hint: 'Режим доступа к произвольному серверу с использованием персонального токена. Требуется выпуск токена и настройка разрешений сервера. Введенная информация НЕ ХРАНИТСЯ на серверах DocHub. Она сохранятся в локальном хранилище вашего браузера или IDE плагина.'
          }
        ]
      };
    },
    computed: {
      isChanged() {
        return (this.mode !== this.selMode?.id)
          || (this.server !== this.selServer)
          || (this.personalToken !== this.selPersonalToken)
          || (this.username !== this.selUsername);
      },
      selPersonalToken: {
        get() {
          return this.personalToken_ || this.personalToken;
        },
        set(value) {
          return this.personalToken_ = value;
        }
      },
      selServer: {
        get() {
          return this.server_ || this.server;
        },
        set(value) {
          this.server_ = value;
        }
      },
      selUsername: {
        get() {
          return this.username_ || this.username;
        },
        set(value) {
          this.username_ = value;
        }
      },
      selMode: {
        get() {
          return this.mode_ || this.modes.find((item) => item.id === this.mode) || this.modes[0];
        },
        set(value) {
          this.mode_ = value;
        }
      },
      logo() {
        return this.makeURLDataCode(require('!!raw-loader!../../assets/gitlab-logo.svg').default);
      },
      fields() {
        return this.getFields(this.selMode?.id);
      }
    },
    methods: {
      makeConfig() {
        return {
          mode: this.selMode?.id,
          server: this.selServer,
          personalToken: this.selPersonalToken,
          username: this.selUsername
        };
      },
      async doCheckIntegration() {
        const result = await this.checkIntegration(this.makeConfig());
        if (result === true) {
          this.checkError = null;
          return true;
        }
        switch (result?.response?.status) {
          case 400: this.checkError = 'Вероятно неверно указан сервер или его версия API не подходит'; break;
          case 401: this.checkError = 'Пользователь не авторизован'; break;
          case 403: this.checkError = 'Доступ запрещен сервером'; break;
          case 503: this.checkError = 'Сервер временно недоступен. Повторите попытку позже.'; break;
          default:
            if (Number.parseInt(result.response?.status) >= 500) 
              this.checkError = 'Возникла непредвиденная ошибка на сервере.';
            else 
              this.checkError = 'Вероятно в параметрах интеграции ошибка. Проверьте введенные значения параметров и повторите попытку';
        }
        return false;
      },
      validate() {
        if(this.$refs.form.validate()) {
          this.isSettingDisabled = true;
          this.isProcessing = true;
          this.doCheckIntegration()
            .then((result) => result && this.applySettings())
            .finally(() => {
              this.isSettingDisabled = false;
              this.isProcessing = false;
            });
        }
      },
      applySettings() {
        this.$emit('apply', {
          mode: this.selMode?.id,
          server: this.selServer,
          personalToken: this.selPersonalToken,
          username: this.selUsername
        });
      },
      reset() {
        this.mode_ = null;
        this.server_ = null;
        this.personalToken_ = null;
        this.username_ = null;
        this.checkError = null;
      }
    }
  };
</script>

<style>

</style>
