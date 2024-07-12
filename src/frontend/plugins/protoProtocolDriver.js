export default {
    isActive: () => false,
    // Вызывается при инициализации транспортного сервиса
    //  context: object     - контекст функционирования сервиса
    bootstrap() { },
    resolveURL(...segments) {
        let result = null;
        const applySegment = (segment) => {
            if (!result) {
                result = segment;
            } else {
                result = new URL(
                    segment,
                    new URL(result, location.origin)
                );
            }
        };
        segments.map((segment) => segment && applySegment(segment));
        return result.toString();
    }
};
