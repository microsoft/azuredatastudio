/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess } from '../quickaccess';

export class TaskPanel {

	constructor(private code: Code, private quickAccess: QuickAccess) {
	}

	async showTaskPanel(): Promise<void> {
		await this.quickAccess.runCommand('workbench.action.tasks.toggleTasks');
	}

	async waitForTaskComplete(task: string): Promise<void> {
		await this.code.waitForElement(`div.label[title*="${task}"]`, undefined, 3000); // wait up to 5 minutes for task to complete
	}

}
