export default {
    methods: {
        makeURLDataCode(source) {
            const base64 = btoa(unescape(encodeURIComponent(source)));
            const encoded = `data:image/svg+xml;base64,${base64}`;
            return encoded;
          }
    }
};
