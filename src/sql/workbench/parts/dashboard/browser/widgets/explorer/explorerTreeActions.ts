/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ManageAction, ManageActionContext } from 'sql/workbench/common/actions';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';
import { IEditorProgressService } from 'vs/platform/progress/common/progress';
import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';

export class ExplorerManageAction extends ManageAction {
	public static readonly ID = 'explorerwidget.manage';
	constructor(
		id: string, label: string,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IAngularEventingService angularEventingService: IAngularEventingService,
		@IEditorProgressService private _progressService: IEditorProgressService
	) {
		super(id, label, connectionManagementService, angularEventingService);
	}

	public run(actionContext: ManageActionContext): Promise<boolean> {
		const promise = super.run(actionContext);
		this._progressService.showWhile(promise);
		return promise;
	}
}

export class CustomExecuteCommandAction extends ExecuteCommandAction {
	run(context: ManageActionContext): Promise<any> {
		return super.run(context.profile);
	}
}
