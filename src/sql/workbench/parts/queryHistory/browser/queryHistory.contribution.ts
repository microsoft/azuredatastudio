/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyMod, KeyCode } from 'vs/base/common/keyCodes';
import { localize } from 'vs/nls';
import { SyncActionDescriptor, MenuRegistry, MenuId } from 'vs/platform/actions/common/actions';
import { IWorkbenchActionRegistry, Extensions as ActionExtensions } from 'vs/workbench/common/actions';
import { Registry } from 'vs/platform/registry/common/platform';
import { QueryHistoryPanel } from 'sql/workbench/parts/queryHistory/browser/queryHistoryPanel';
import * as lifecycle from 'vs/base/common/lifecycle';
import * as ext from 'vs/workbench/common/contributions';
import { IActivityService, NumberBadge } from 'vs/workbench/services/activity/common/activity';
import { LifecyclePhase } from 'vs/platform/lifecycle/common/lifecycle';
import { PanelRegistry, Extensions as PanelExtensions, PanelDescriptor } from 'vs/workbench/browser/panel';
import { QUERY_HISTORY_PANEL_ID } from 'sql/workbench/parts/queryHistory/common/constants';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { ToggleQueryHistoryAction } from 'sql/workbench/parts/queryHistory/browser/queryHistoryActions';

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

// Register StatusUpdater
// (<ext.IWorkbenchContributionsRegistry>Registry.as(ext.Extensions.Workbench)).registerWorkbenchContribution(StatusUpdater, LifecyclePhase.Restored);

MenuRegistry.appendMenuItem(MenuId.MenubarViewMenu, {
	group: '4_panels',
	command: {
		id: ToggleQueryHistoryAction.ID,
		title: localize({ key: 'miViewQueryHistory', comment: ['&& denotes a mnemonic'] }, "&&Query History")
	},
	order: 2
});
