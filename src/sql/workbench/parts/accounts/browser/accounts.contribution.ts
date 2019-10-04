/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { Disposable } from 'vs/base/common/lifecycle';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { IStatusbarService, StatusbarAlignment } from 'vs/workbench/services/statusbar/common/statusbar';
import { localize } from 'vs/nls';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';

const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);

CommandsRegistry.registerCommand('workbench.actions.modal.linkedAccount', accessor => {
	const accountManagementService = accessor.get(IAccountManagementService);
	accountManagementService.openAccountListDialog();
});

class AccountsStatusBarContributions extends Disposable implements IWorkbenchContribution {

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService
	) {
		super();
		this._register(
			this.statusbarService.addEntry({
				command: 'workbench.actions.modal.linkedAccount',
				text: '$(person-filled)'
			},
				'status.accountList',
				localize('status.problems', "Problems"),
				StatusbarAlignment.LEFT, 15000 /* Highest Priority */)
		);
	}
}

workbenchRegistry.registerWorkbenchContribution(AccountsStatusBarContributions, LifecyclePhase.Restored);
