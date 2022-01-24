/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ICommandService } from 'vs/platform/commands/common/commands';
import { KeyMod, KeyCode, KeyChord } from 'vs/base/common/keyCodes';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { HideActivityBarViewContainers, HideSettings, HidePanel } from 'sql/workbench/contrib/tsgops/tsgopsActions';
import { IWorkbenchContribution, Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import product from 'vs/platform/product/common/product';

// Global Actions
const actionRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions);

actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		HideActivityBarViewContainers,
		HideActivityBarViewContainers.ID,
		HideActivityBarViewContainers.LABEL,
		{ primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_V) }
	),
	HideActivityBarViewContainers.LABEL
);
actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		HideSettings,
		HideSettings.ID,
		HideSettings.LABEL,
		{ primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_V) }
	),
	HideSettings.LABEL
);
actionRegistry.registerWorkbenchAction(
	SyncActionDescriptor.create(
		HidePanel,
		HidePanel.ID,
		HidePanel.LABEL,
		{ primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KEY_K, KeyMod.CtrlCmd | KeyCode.KEY_V) }
	),
	HidePanel.LABEL
);

export class ADSWebLite implements IWorkbenchContribution {
	constructor(
		@ICommandService private commandService: ICommandService,
	) {
		this.createTSGOpsImage();
	}

	private async createTSGOpsImage(): Promise<void> {
		await this.commandService.executeCommand('workbench.action.hideSettings');
		await this.commandService.executeCommand('workbench.action.hidePanel');
		await this.commandService.executeCommand('workbench.action.hideActivityBarViewContainers');
	}
}

if (product.quality === 'tsgops-image') {
	Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
		.registerWorkbenchContribution(ADSWebLite, LifecyclePhase.Restored);
}
