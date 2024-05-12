<template>
  <div class="place">
    <iframe class="video" v-bind:src="src" />
  </div>
</template>

<script>
  export default {
    name: 'DHYoutube',
    props: {
      src: { type: String, default: '' }
    },
    data() {
      return {
        error: null,
        data: null
      };
    }
  };
</script>

<style scoped>
.place {
  width: 100%;
  text-align: center;
}

.video {
  border: none;
  width: 100%;
  max-width: 1024px;
  height: auto;
  aspect-ratio: 16/9;
}
</style>
