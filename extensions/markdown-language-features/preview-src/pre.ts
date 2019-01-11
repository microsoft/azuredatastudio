/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CspAlerter } from './csp';
import { StyleLoadingMonitor } from './loading';

declare global {
	interface Window {
		cspAlerter: CspAlerter;
		styleLoadingMonitor: StyleLoadingMonitor;
	}
}

window.cspAlerter = new CspAlerter();
window.styleLoadingMonitor = new StyleLoadingMonitor();