/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/taskHistoryViewlet';
import { TPromise } from 'vs/base/common/winjs.base';
import { Viewlet } from 'vs/workbench/browser/viewlet';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { toggleClass, Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { isPromiseCanceledError } from 'vs/base/common/errors';
import Severity from 'vs/base/common/severity';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TaskHistoryView } from 'sql/parts/taskHistory/viewlet/taskHistoryView';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService } from 'vs/platform/storage/common/storage';

export const VIEWLET_ID = 'workbench.view.taskHistory';

export class TaskHistoryViewlet extends Viewlet {

	private _root: HTMLElement;
	private _toDisposeViewlet: IDisposable[] = [];
	private _taskHistoryView: TaskHistoryView;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@INotificationService private _notificationService: INotificationService,
		@IPartService partService: IPartService,
		@IConfigurationService configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService
	) {
		super(VIEWLET_ID, configurationService, partService, telemetryService, themeService, storageService);
	}

	private onError(err: any): void {
		if (isPromiseCanceledError(err)) {
			return;
		}
		this._notificationService.notify({
			severity: Severity.Error,
			message: err
		});
	}

	public create(parent: HTMLElement): TPromise<void> {
		super.create(parent);
		this._root = parent;
		this._taskHistoryView = this._instantiationService.createInstance(TaskHistoryView);
		this._taskHistoryView.renderBody(parent);

		return TPromise.as(null);
	}

	public setVisible(visible: boolean): void {
		super.setVisible(visible);
		this._taskHistoryView.setVisible(visible);
	}

	public focus(): void {
		super.focus();
	}

	public layout({ height, width }: Dimension): void {
		this._taskHistoryView.layout(height);
		toggleClass(this._root, 'narrow', width <= 350);
	}

	public getOptimalWidth(): number {
		return 400;
	}

	public dispose(): void {
		this._toDisposeViewlet = dispose(this._toDisposeViewlet);
	}

}
