/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Code } from '../code';
import { QuickAccess } from '../quickaccess';

export class TaskPanel {

	private static readonly taskPanelSelector = 'div.pane-body.task-history';

	constructor(private code: Code, private quickAccess: QuickAccess) {
	}

	async showTaskPanel(): Promise<void> {
		await this.quickAccess.runCommand('workbench.panel.tasks.view.focus');
	}

	/**
	 * Wait for the given task message in the task panel.
	 * @param task The task completed message.
	 * @param waitTime The amount of time to wait for the task to complete. By default, this is 1 minute.
	 */
	async waitForTaskComplete(task: string, waitTime: number = 600): Promise<void> {
		await this.code.waitForElement(`${TaskPanel.taskPanelSelector} div.label[title="${task}"]`, undefined, waitTime);
	}

}
