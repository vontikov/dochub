import { DocHub } from 'dochub-sdk';
import Viewer from './src/components/Viewer.vue';
import Editor from './src/components/Editor.vue';
import Constructor from './src/components/Constructor.vue';

DocHub.documents.register('markdown', Viewer as any);
DocHub.editors.register('markdown', Editor as any, 'Markdown');
DocHub.constructors.register('markdown.document.creator', 'Создать Markdown документ', Constructor as any);
