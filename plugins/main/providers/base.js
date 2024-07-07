/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */

export default {
    active: false,           // Признак активности драйвера
    // Возвращает true если драйвер готов обрабатывать запросы
    isActive() {
        return this.active;
    },
    // Вызывается при инициализации драйвера контента
    //  context: object     - контекст функционирования сервиса
    //      {
    //      }
    bootstrap(context) {
        this.active = true;
    },
    // Преобразует контент в объект DataLake
    toObject(content) {

    },
    // Преобразует объект DataLake в контент
    toContent(object) {

    }
};
