/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess } from '../quickaccess';
import { Dialog } from './dialog';

const NEW_SESSION_DIALOG_TITLE: string = 'Start New Profiler Session';

export class Profiler extends Dialog {

	constructor(code: Code, private quickopen: QuickAccess) {
		super(NEW_SESSION_DIALOG_TITLE, code);
	}

	async launchProfiler(): Promise<void> {
		await this.quickopen.runCommand('Profiler: Launch Profiler');
	}

	async waitForNewSessionDialog() {
		await this.waitForNewDialog();
	}

	async waitForNewSessionDialogAndStart() {
		await this.waitForNewSessionDialog();
		await this.clickDialogButton('Start');
	}
}
