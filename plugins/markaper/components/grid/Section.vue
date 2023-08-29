<template>
  <div class="mkr-grid-section" v-bind:style="style.section">
    <v-card-title v-if="section.title || section.icon">
      <v-icon v-if="section.icon" left>{{ section.icon }}</v-icon>
      <span v-if="section.title" class="title"> {{ section.title }}</span>
    </v-card-title>    
    <mkrcontent v-if="isContent" v-bind:src="src" v-bind:style="style.content" />
    <template v-else>
      <mkrcolumns
        v-if="(section.type || '').toLowerCase()==='columns'"
        v-bind:items="items" />
      <mkrrows
        v-if="(section.type || '').toLowerCase()==='rows'"
        v-bind:items="items" />
    </template>
  </div>
</template>

<script>

  import MKRColumns from './Columns.vue';
  import MKRContent from '../elements/Content.vue';
  import MKRRows from './Rows.vue';
  import { appendParams } from '../../helpers/src';

  const contentStyles = ['padding'];
  
  export default {
    name: 'MKRSection',
    components: {
      mkrcolumns: MKRColumns,
      mkrrows: MKRRows,
      mkrcontent: MKRContent
    },
    props: {
      // Требуем обязательно передавать структуру секции
      section: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
      };
    },
    computed: {
      style() {
        const content = {};
        const section = {};
        const style = this.section.style ?? {};

        for (const id in style) {
          if (contentStyles.indexOf(id) >=0 ) content[id] = style[id];
          else section[id] = style[id];
        }

        if (section.border) {
          section['box-shadow'] = '0 3px 1px -2px #0003, 0 2px 2px 0 #00000024, 0 1px 5px 0 #0000001f';
        }

        if (section['max-height'] && section['max-width']) section.overflow = 'auto';
        else if (section['max-height']) section['overflow-y'] = 'auto';
        else if (section['max-width']) section['overflow-x'] = 'auto';

        return {
          content,
          section
        };
      },
      isObject() {
        return (this.section?.src || '').slice(0, 1) === '@';
      },
      src() {
        return appendParams(this.section.src, this.section.params);
      },
      isContent() {
        return !!this.section?.src;
      },
      items() {
        return this.section?.items || [];
      }
    }
  };
</script>

<style scoped>

  .mkr-grid-section > .dochub-object {
    margin: 0 !important;
    position: relative;
  }

</style>
