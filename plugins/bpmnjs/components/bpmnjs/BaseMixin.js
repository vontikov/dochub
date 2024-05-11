
export default {
    props: {
        // Требуем обязательно передавать профайл документа 
        profile: {
            type: Object,
            required: true
        },
        // Требуем обязательно передавать функцию получения контента
        getContent: {
            type: Function,
            required: true
        },
        // Требуем обязательно передавать функцию сохранения контента
        putContent: {
            type: Function,
            required: true
        },
        // Содержимое документа
        value: String
    },
    methods: {
        // Методы для реализации в компонентах
        // init() { },
        // applyContent(content) { },

        // Регистрация ошибки
        registerError(error) {
            this.errors.push(error);
        },
        // Регистрация предупреждений
        registerWarning(warning) {
            this.warnings.push(warning);
        }
    },
    watch: {
        value(value) {
            this.applyContent(value);
        }
    },
    mounted() {
        this.init();
        this.applyContent(this.value);
    },
    data() {
        return {
            errors: [],
            warnings: [],
            data: null
        };
    }
};
