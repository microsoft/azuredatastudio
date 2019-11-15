/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ManageAction, ManageActionContext } from 'sql/workbench/browser/actions';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IAngularEventingService } from 'sql/platform/angularEventing/browser/angularEventingService';
import { ExecuteCommandAction } from 'vs/platform/actions/common/actions';

export class ExplorerManageAction extends ManageAction {
	public static readonly ID = 'explorerwidget.manage';
	constructor(
		id: string, label: string,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IAngularEventingService angularEventingService: IAngularEventingService,
	) {
		super(id, label, connectionManagementService, angularEventingService);
	}

	public run(actionContext: ManageActionContext): Promise<boolean> {
		const promise = super.run(actionContext);
		return promise;
	}
}

export class CustomExecuteCommandAction extends ExecuteCommandAction {
	run(context: ManageActionContext): Promise<any> {
		return super.run(context.profile);
	}
}
