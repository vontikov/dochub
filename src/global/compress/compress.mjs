const COMPRESS_METHOD = 'gzip'; //deflate

export default function(driver) {

    const compressor = {
        // eslint-disable-next-line no-undef
        DecompressionStream: driver?.DecompressionStream || DecompressionStream,
        // eslint-disable-next-line no-undef
        CompressionStream: driver?.CompressionStream || CompressionStream
    };

    return {
        // Упаковывает строку в COMPRESS_METHOD
        encodeBin: async function(str) {
            const byteArray = new TextEncoder().encode(str);
            const cs = new compressor.CompressionStream(COMPRESS_METHOD);
            const writer = cs.writable.getWriter();
            writer.write(byteArray);
            writer.close();
            return new Response(cs.readable).arrayBuffer();
        },

        // Упаковывает строку в COMPRESS_METHOD и кодирует в base64
        encodeBase64: async function(str) {
            const bin = new Uint8Array(await this.encodeBin(str));
            const strOut = String.fromCodePoint(...bin);
            const base64 = btoa(strOut);
            return base64;
        },

        // Распаковывает byteArray из COMPRESS_METHOD в строку
        decodeBin: async function(byteArray) {
            const cs = new compressor.DecompressionStream(COMPRESS_METHOD);
            const writer = cs.writable.getWriter();
            writer.write(byteArray);
            writer.close();
            return new TextDecoder().decode(await new Response(cs.readable).arrayBuffer());
        },

        // Распаковывает строку из COMPRESS_METHOD и кодирует в base64
        decodeBase64: async function(base64) {
            const str = atob(base64);
            const bin = Uint8Array.from(Buffer.from(str, 'binary'));
            const result = await this.decodeBin(bin);
            return result;
        }
    };
}

