import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

import viewer from './components/Viewer.vue';
import modeler from './components/Modeler.vue';

DocHub.documents.register('bpmnjs-viewer', viewer);
DocHub.documents.register('bpmnjs-modeler', modeler);
