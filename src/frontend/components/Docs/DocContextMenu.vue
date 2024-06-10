<template>
  <v-menu
    v-model="isShow"
    v-bind:position-x="x"
    v-bind:position-y="y"
    style="z-index: 1000"
    absolute
    offset-y>
    <v-list>
      <v-list-item
        v-for="item in items"
        v-bind:key="item.id"
        link
        v-on:click="item.on(item)">
        <v-list-item-title>
          {{ item.title }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>

  export default {
    name: 'DocContextMenu',
    props: {
      items: {
        type: Array,
        default: null
      },
      x: {
        type: Number,
        default: 0
      },
      y: {
        type: Number,
        default: 0
      },
      value: {
        type: Boolean,
        default: false
      }
    },
    data() {
      return {};
    },
    computed: {
      isShow: {
        get() { return this.value; },
        set(value) { this.$emit('input', value); }
      }
    }
  };
</script>
