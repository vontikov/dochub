<template>
  <g>
    <g
      v-for="box in layer.boxes"
      v-bind:key="box.node.id">
      <g v-if="isArea(box)">
        <rect
          v-if="isArea(box)"
          class="box"
          v-bind:x="box.absoluteX"
          v-bind:y="box.absoluteY"
          v-bind:width="box.width"
          v-bind:height="box.height" />
      </g>
      <g v-else>
        <rect
          class="node"
          v-bind:x="box.absoluteX"
          v-bind:y="box.absoluteY"
          v-bind:width="box.width"
          v-bind:height="box.height" />
      </g>
      <schema-debug-node
        v-bind:offset-x="box.x"
        v-bind:offset-y="box.y"
        v-bind:layer="box.node" />
    </g>
  </g>
</template>

<script>

  const SchemaDebugNode = {
    name: 'DHSchemaDebugNode',
    props: {
      offsetX: {
        type: Number,
        required: true
      },
      offsetY: {
        type: Number,
        required: true
      },
      layer: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
      };
    },
    methods: {
      isArea(item) {
        return item.node.subitems && Object.keys(item.node.subitems).length;
      }
    }
  };

  SchemaDebugNode.components = {
    SchemaDebugNode
  };

  export default SchemaDebugNode;
</script>

<style scoped>
.box {
  stroke: rgba(0,0,0,.4);
  fill: none;
}

.node {
  stroke: rgba(255,0,0,.6);
  fill: none;
}

</style>
