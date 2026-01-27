/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

global.Buffer = global.Buffer || require('buffer').Buffer;
global.process = require('process');

AppRegistry.registerComponent(appName, () => App);
