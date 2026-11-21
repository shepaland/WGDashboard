import {createApp} from 'vue';
import 'bootstrap/dist/css/bootstrap.min.css';
import Routing from '../../src/views/routing/index.vue';
window.history.replaceState({},'', '/vpn/');
createApp(Routing).mount('#app');
