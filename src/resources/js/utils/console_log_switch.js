/**
 * Switch for console.log, which the AI engines (every version) call every
 * frame. Logging only now and then made play stutter, so the engines log
 * steadily instead; this lets it be turned off altogether.
 *
 * Off by default. Add ?log=1 to the URL to turn console.log on, ?log=0 to
 * turn it off again. The choice is remembered. console.error and console.warn
 * are untouched.
 */
'use strict';

import { localStorageWrapper } from './local_storage_wrapper.js';

const STORAGE_KEY = 'pv-offline-consoleLog';
/** Used when neither the URL nor an earlier visit says otherwise. */
const DEFAULT_ENABLED = false;

const fromUrl = new URLSearchParams(location.search).get('log');
if (fromUrl === '0' || fromUrl === '1') {
  localStorageWrapper.set(STORAGE_KEY, fromUrl);
}
const saved = localStorageWrapper.get(STORAGE_KEY);

/** Whether console.log prints on this page. */
export const consoleLogEnabled =
  saved === null ? DEFAULT_ENABLED : saved === '1';

if (!consoleLogEnabled) {
  console.log = () => {};
}
