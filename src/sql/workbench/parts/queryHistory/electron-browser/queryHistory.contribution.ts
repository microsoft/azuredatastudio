/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { QueryHistoryWorkbenchContribution } from 'sql/workbench/parts/queryHistory/electron-browser/queryHistory';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { IQueryHistoryService } from 'sql/platform/queryHistory/common/queryHistoryService';

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(QueryHistoryWorkbenchContribution, LifecyclePhase.Restored);

CommandsRegistry.registerCommand({
	id: 'queryHistory.clear',
	handler: (accessor) => {
		const queryHistoryService = accessor.get(IQueryHistoryService);
		queryHistoryService.clearQueryHistory();
	}
});
