
const driver = {
    // Возвращает true если драйвер готов обрабатывать запросы
    isActive: () => true,
    // Возвращает список методов доступных над URI
    //  uri: string || URL          - Идентификатор ресурса
    //  Returns: Promise: array     - Список доступных HTTP методов для ресурса
    async availableMethodsFor(uri) {
        return uri && ['get'];
    },
    // Запрос к транспорту
    //  options: axios options
    //      {
    //          method?: string                 - HTTP метод из доступных над ресурсом. По умолчанию GET.
    //          url: string || URL              - Идентификатор ресурса над которым осуществляется действие
    //          content?: string                - Данные для запроса
    //                   || object 
    //                   || uint8array
    //      }
    //  Returns: axios response
    request() {
        return new Promise((success) => {
            success({
                headers: {
                    'content-type': 'application/json; charset=UTF-8'
                },
                data: JSON.stringify({
                  docs: {
                    'dochub.plugins.main.git.manager': {
                        location: '/GitHub',
                        type: 'main-gitmanager',
                        order: 100000
                    }
                  }  
                })
            });
        });
    }
};

export default driver;
