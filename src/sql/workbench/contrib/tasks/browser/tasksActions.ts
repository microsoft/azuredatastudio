/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { ToggleViewAction } from 'vs/workbench/browser/actions/layoutActions';
import { IViewsService, IViewDescriptorService } from 'vs/workbench/common/views';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { TASKS_VIEW_ID } from 'sql/workbench/contrib/tasks/common/tasks';

export class ToggleTasksAction extends ToggleViewAction {

	public static readonly ID = 'workbench.action.tasks.toggleTasks';
	public static readonly LABEL = localize('toggleTasks', "Toggle Tasks");

	constructor(
		id: string, label: string,
		@IViewsService viewsService: IViewsService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService
	) {
		super(id, label, TASKS_VIEW_ID, viewsService, viewDescriptorService, contextKeyService, layoutService);
	}
}
