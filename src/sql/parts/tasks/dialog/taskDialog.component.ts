/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ConnectionManagementInfo } from 'sql/platform/connection/common/connectionManagementInfo';
import { ITaskDialogComponent } from 'sql/parts/tasks/common/tasks';
import { ITaskDialogComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import { ElementRef, Component, Inject, forwardRef } from '@angular/core';
import { IBootstrapParams } from 'sql/services/bootstrap/bootstrapService';

export const TASKDIALOG_SELECTOR: string = 'taskdialog-component';

@Component({
	selector: TASKDIALOG_SELECTOR,
	templateUrl: decodeURI(require.toUrl('sql/parts/tasks/dialog/taskDialog.component.html')),
})
export class TaskDialogComponent {

	private _currentComponent: ITaskDialogComponent;

	public ownerUri: string;

	public connection: ConnectionManagementInfo;

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IBootstrapParams) private _parameters: ITaskDialogComponentParams
	) {
		this.ownerUri = this._parameters.ownerUri;

	}

	public onActivate(component: any) {
		// validate the component implements ITaskDialogComponent (or at least part of the interface)
		if ((<ITaskDialogComponent>component).onOk) {
			this._currentComponent = <ITaskDialogComponent>component;
			this._currentComponent.injectBootstapper(this._parameters);
		} else {
			this._currentComponent = undefined;
		}
	}

	public onDeactivate(component: any) {

	}
}
