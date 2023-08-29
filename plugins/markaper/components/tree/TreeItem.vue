<template>
  <ul class="items">
    <li v-for="item in items" v-bind:key="item.key" v-bind:class="{'item': true, 'selected' : item.selected}">
      <v-icon v-if="item.items && item.items.length" class="expand-ico" v-on:click="onExpand(item)">
        <template v-if="expands[item.key]">expand_more</template>
        <template v-else>chevron_right</template>
      </v-icon>
      <v-icon v-if="item.icon" class="item-ico" v-bind:style="item.iconStyle">
        {{ item.icon }}
      </v-icon>
      <router-link v-if="item.link" v-bind:to="item.link">
        {{ getTitleOfItem(item) }}
      </router-link>
      <template v-else>
        {{ getTitleOfItem(item) }}
      </template>
      <template v-if="item.items && expands[item.key]">
        <tree-item v-bind:expands="expands" v-bind:items="item.items" />
      </template>
    </li>
  </ul>
</template>

<script>

  const TreeItem = {
    name: 'MKRTreeItem',
    mounted() {
      this.refreshExpand(this.items);
    },
    methods: {
      getTitleOfItem(item) {
        return item.count ? `${item.title} (${item.count})` : item.title;
      },
      refreshExpand(items) {
        items.map((item) => {
          if (item.expand) 
            this.$set(this.expands, item.key, item);
        });
      },
      onExpand(item) {
        if (this.expands[item.key]) {
          this.$set(this.expands, item.key, false);
        } else {
          this.$set(this.expands, item.key, item);
        }
      }
    },
    watch: {
      state() {
        this.$emit('input', this.state);
      },
      items(items) {
        this.refreshExpand(items);
      }
    },
    props: {
      items: Array,
      expands: Object
    },
    data() {
      return {};
    }
  };

  export default Object.assign(TreeItem, {
    components: {
      TreeItem
    }
  });

</script>

<style scoped>

  .items {
    list-style-type: none;
    padding-left: 28px;
    font-size: 16px;
  }

  .expand-ico {
    margin-left: -28px;
  }

  .item {
    padding-left: 4px;
    padding-right: 4px;
    width: fit-content;
  }

  .item.selected {
    background: rgb(52, 149, 219);
  }

  .item.selected * {
    color: #fff !important;
  }

</style>
