import { DocHub } from 'dochub-sdk';
import Excalidraw from './src/vue/components/Excalidraw.vue';

// Регистрируем документ Excalidraw
DocHub.documents.register('excalidraw', Excalidraw);
