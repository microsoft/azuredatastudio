/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlMainContext, MainThreadWorkspaceShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { Disposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { IWorkspaceEditingService } from 'vs/workbench/services/workspaces/common/workspaceEditing';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IHostService } from 'vs/workbench/services/host/browser/host';

@extHostNamedCustomer(SqlMainContext.MainThreadWorkspace)
export class MainThreadWorkspace extends Disposable implements MainThreadWorkspaceShape {

	constructor(
		extHostContext: IExtHostContext,
		@IWorkspaceEditingService private workspaceEditingService: IWorkspaceEditingService,
		@IWorkbenchEnvironmentService protected readonly environmentService: IWorkbenchEnvironmentService,
		@IHostService private readonly hostService: IHostService
	) {
		super();
	}

	async $createAndEnterWorkspace(folder: URI, workspaceFile?: URI): Promise<void> {
		folder = URI.revive(folder);
		workspaceFile = URI.revive(workspaceFile);
		await this.workspaceEditingService.createAndEnterWorkspace([{ uri: folder }], workspaceFile);
		this.hostService.reload();
	}

	async $enterWorkspace(workspaceFile: URI): Promise<void> {
		workspaceFile = URI.revive(workspaceFile);
		await this.workspaceEditingService.enterWorkspace(workspaceFile);
		this.hostService.reload();
	}

	async $saveAndEnterWorkspace(workspaceFile: URI): Promise<void> {
		workspaceFile = URI.revive(workspaceFile);
		await this.workspaceEditingService.saveAndEnterWorkspace(workspaceFile);
		this.hostService.reload();
	}
}
