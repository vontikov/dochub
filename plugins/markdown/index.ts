import { DocHub } from 'dochub-sdk';
import Viewer from './src/components/Viewer.vue';
import Editor from './src/components/Editor.vue';

DocHub.documents.register('markdown', Viewer as any);
DocHub.editors.register('markdown', Editor as any, 'Markdown');
