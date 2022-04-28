/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess } from '../quickaccess';

export class TaskPanel {

	private static readonly taskPanelSelector = 'div.pane-body.task-history';

	constructor(private code: Code, private quickAccess: QuickAccess) {
	}

	async showTaskPanel(): Promise<void> {
		try {
			await this.code.waitForElement(TaskPanel.taskPanelSelector);
		} catch (e) {
			await this.quickAccess.runCommand('workbench.action.tasks.toggleTasks');
			await this.code.waitForElement(TaskPanel.taskPanelSelector);
		}
	}

	async waitForTaskComplete(task: string): Promise<void> {
		await this.code.waitForElement(`${TaskPanel.taskPanelSelector} div.label[title="${task}"]`, undefined, 3000); // wait up to 5 minutes for task to complete
	}

}
