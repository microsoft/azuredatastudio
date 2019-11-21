/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/tasksPanel';
import { Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TaskHistoryView } from 'sql/workbench/contrib/tasks/browser/tasksView';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { Panel } from 'vs/workbench/browser/panel';
import { TASKS_PANEL_ID } from 'sql/workbench/contrib/tasks/common/tasks';

export class TasksPanel extends Panel {

	private _taskHistoryView: TaskHistoryView;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super(TASKS_PANEL_ID, telemetryService, themeService, storageService);
	}

	public create(parent: HTMLElement): void {
		super.create(parent);
		this._taskHistoryView = this.instantiationService.createInstance(TaskHistoryView);
		this._taskHistoryView.renderBody(parent);
	}

	public setVisible(visible: boolean): void {
		super.setVisible(visible);
		this._taskHistoryView.setVisible(visible);
	}

	public layout({ height }: Dimension): void {
		this._taskHistoryView.layout(height);
	}
}
