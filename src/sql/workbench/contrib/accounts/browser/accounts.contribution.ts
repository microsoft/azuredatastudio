/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CommandsRegistry } from 'vs/platform/commands/common/commands';
import { IAccountManagementService } from 'sql/platform/accounts/common/interfaces';

CommandsRegistry.registerCommand('workbench.actions.modal.linkedAccount', async accessor => {
	const accountManagementService = accessor.get(IAccountManagementService);
	await accountManagementService.openAccountListDialog();
});

