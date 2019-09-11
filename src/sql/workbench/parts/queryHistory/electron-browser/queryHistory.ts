/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IQueryHistoryService } from 'sql/platform/queryHistory/common/queryHistoryService';
import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';
import { QueryHistoryPanel } from 'sql/workbench/parts/queryHistory/browser/queryHistoryPanel';
import { PanelRegistry, Extensions as PanelExtensions, PanelDescriptor } from 'vs/workbench/browser/panel';
import { QUERY_HISTORY_PANEL_ID } from 'sql/workbench/parts/queryHistory/common/constants';
import { ToggleQueryHistoryAction } from 'sql/workbench/parts/queryHistory/browser/queryHistoryActions';
import { CommandsRegistry } from 'vs/platform/commands/common/commands';

export class QueryHistoryWorkbenchContribution implements IWorkbenchContribution {

	private queryHistoryEnabled: boolean = false;

	constructor(
		@IQueryHistoryService _queryHistoryService: IQueryHistoryService
	) {
		// We need this to be running in the background even if the Panel (which is currently the only thing using it)
		// isn't shown yet. Otherwise the service won't be initialized until the Panel is which means we might miss out
		// on some events
		_queryHistoryService.start();

		// This feature is in preview so for now hide it behind a flag. We expose this as a command
		// so that the query-history extension can call it. We eventually want to move all this into
		// the extension itself so this should be a temporary workaround
		CommandsRegistry.registerCommand({
			id: 'queryHistory.enableQueryHistory',
			handler: () => {
				// This should never be called more than once, but just in case
				// we don't want to try and register multiple times
				if (!this.queryHistoryEnabled) {
					this.queryHistoryEnabled = true;
					const registry = Registry.as<IWorkbenchActionRegistry>(ActionExtensions.WorkbenchActions);
					registry.registerWorkbenchAction(
						new SyncActionDescriptor(
							ToggleQueryHistoryAction,
							ToggleQueryHistoryAction.ID,
							ToggleQueryHistoryAction.LABEL,
							{ primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_T }),
						'View: Toggle Query history',
						localize('viewCategory', "View")
					);

					// Register Output Panel
					Registry.as<PanelRegistry>(PanelExtensions.Panels).registerPanel(new PanelDescriptor(
						QueryHistoryPanel,
						QUERY_HISTORY_PANEL_ID,
						localize('queryHistory', "Query History"),
						'output',
						20,
						ToggleQueryHistoryAction.ID
					));

					MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
						group: '4_panels',
						command: {
							id: ToggleQueryHistoryAction.ID,
							title: localize({ key: 'miViewQueryHistory', comment: ['&& denotes a mnemonic'] }, "&&Query History")
						},
						order: 2
					});
				}
			}
		});
	}
}
