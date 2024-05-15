<template>
  <div class="place">
    <iframe class="video" v-bind:src="url" />
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
    },
    computed: {
      url() {
        let result = this.src;
        if (this.src.toLowerCase().startsWith('https://www.youtube.com/')) {
          const url = new URL(this.src);
          result.type = 'youtube';
          if (url.pathname.startsWith('/embed/')) {
            result = this.src;
          } else if (url.pathname.startsWith('/watch')) {
            result = `https://www.youtube.com/embed/${url.searchParams.get('v')}`;
          }
        } else if (this.src.toLowerCase().startsWith('https://youtu.be/')) {
          result = `https://www.youtube.com/embed/${this.src.slice(16)}`;
        }
        return result;
      }
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
