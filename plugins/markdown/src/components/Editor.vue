<template>
  <div class="markdown-editor">
    <v-row>
      <v-toolbar class="toolbar" flat>
        <v-toolbar-title>{{ profile.title || profile.location }}</v-toolbar-title>
        <v-spacer />
        <v-btn v-if="isChanged" icon title="Сохранить" @click="onSave">
          <v-icon>mdi-content-save</v-icon>
        </v-btn>
        <v-btn icon title="Выйти" @click="onExit">
          <v-icon>mdi-exit-run</v-icon>
        </v-btn>
      </v-toolbar>
      <v-progress-linear v-if="isSaving" indeterminate />
    </v-row>
    <v-row>
      <coder :code="code" :api="coderAPI" @onchange="onChange" />
    </v-row>
    <v-snackbar v-model="saveSuccess" timeout="1000">
      Сохранено!
      <template #action="{ attrs }">
        <v-btn color="blue" text v-bind="attrs" @click="saveSuccess = false">
          Закрыть
        </v-btn>
      </template>
    </v-snackbar>    
  </div>
</template>

<script>
  import coder from './Coder.vue';
 
  export default {
    name: 'MarkdownEditor',
    components: {
      coder
    },
    props: {
      profile: {
        type: Object,
        required: true
      },
      code: {
        type: String,
        required: false,
        default: ''
      }
    },
    data() {
      return {
        isChanged: false,
        saveSuccess: false,
        isSaving: false,
        coderAPI: {
          getCode() { return null; }
        }
      };
    },
    methods: {
      onChange(state) {
        this.isChanged = state;
      },
      onExit() {
        this.$emit('exit');
      },
      onSave() {
        this.isSaving = true;
        this.$emit('save', {
          code: this.coderAPI.getCode(),
          success: () => {
            this.saveSuccess = true;
            this.isChanged = false;
            this.isSaving = false;
          },
          reject: () => this.isSaving = false
        });
      }
    }
  };
</script>

<style scoped>

.markdown-editor {
  width: 100%;
  min-height: 400px;
  padding-left: 12px;
  padding-right: 12px;  
}

.markdown-editor .toolbar {
  background-color: #f5f5f5;
  padding-left: 12px;
  padding-top: 6px;
}

</style>
