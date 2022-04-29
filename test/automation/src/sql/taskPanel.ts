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
		await this.quickAccess.runCommand('workbench.panel.tasks.view.focus');
	}

	async waitForTaskComplete(task: string, waitTime: number = 600): Promise<void> {
		await this.code.waitForElement(`${TaskPanel.taskPanelSelector} div.label[title="${task}"]`, undefined, waitTime); // By default, wait up to 1 minute for task to complete
	}

}
