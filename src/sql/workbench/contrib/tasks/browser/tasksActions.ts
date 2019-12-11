/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { TogglePanelAction } from 'vs/workbench/browser/panel';
import { TASKS_PANEL_ID } from 'sql/workbench/contrib/tasks/common/tasks';

export class ToggleTasksAction extends TogglePanelAction {

	public static readonly ID = 'workbench.action.tasks.toggleTasks';
	public static readonly LABEL = localize('toggleTasks', "Toggle Tasks");

	constructor(
		id: string, label: string,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IPanelService panelService: IPanelService,
	) {
		super(id, label, TASKS_PANEL_ID, panelService, layoutService);
	}
}
