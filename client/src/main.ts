import './css';
import './css/dev.css';
import { DEV_LOGGER as log } from './utils/';

log('main.ts:', import.meta.env.DEV, typeof import.meta.env.DEV);
