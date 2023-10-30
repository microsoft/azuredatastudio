/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ManageAction, ManageActionContext } from 'sql/workbench/browser/actions';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IAngularEventingService } from 'sql/platform/angularEventing/browser/angularEventingService';

export class ExplorerManageAction extends ManageAction {
	public static override readonly ID = 'explorerwidget.manage';
	constructor(
		id: string, label: string,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IAngularEventingService angularEventingService: IAngularEventingService,
	) {
		super(id, label, connectionManagementService, angularEventingService);
	}

	public override async run(actionContext: ManageActionContext): Promise<void> {
		await super.run(actionContext);
	}
}
