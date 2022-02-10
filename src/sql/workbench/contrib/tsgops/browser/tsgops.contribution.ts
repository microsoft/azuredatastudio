/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { ICommandService } from 'vs/platform/commands/common/commands';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchActionRegistry, Extensions as WorkbenchActionExtensions } from 'vs/workbench/common/actions';
import { SyncActionDescriptor } from 'vs/platform/actions/common/actions';
import { HideActivityBarViewContainers, HideSettings, HidePanel } from 'sql/workbench/contrib/tsgops/browser/tsgopsActions';
import { IWorkbenchContribution, Extensions as WorkbenchExtensions, IWorkbenchContributionsRegistry } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import product from 'vs/platform/product/common/product';
import { TSGOPS_WEB_QUALITY } from 'sql/workbench/common/constants';
export class ADSWebLite implements IWorkbenchContribution {
	constructor(
		@ICommandService private commandService: ICommandService,
	) {
		void this.createTSGOpsImage();
	}

	private async createTSGOpsImage(): Promise<void> {
		await this.commandService.executeCommand('workbench.action.hideSettings');
		await this.commandService.executeCommand('workbench.action.hidePanel');
		await this.commandService.executeCommand('workbench.action.hideActivityBarViewContainers');
	}
}

if (product.quality === TSGOPS_WEB_QUALITY) {
	// Global Actions
	const actionRegistry = Registry.as<IWorkbenchActionRegistry>(WorkbenchActionExtensions.WorkbenchActions);

	actionRegistry.registerWorkbenchAction(
		SyncActionDescriptor.create(
			HideActivityBarViewContainers,
			HideActivityBarViewContainers.ID,
			HideActivityBarViewContainers.LABEL
		),
		HideActivityBarViewContainers.LABEL
	);
	actionRegistry.registerWorkbenchAction(
		SyncActionDescriptor.create(
			HideSettings,
			HideSettings.ID,
			HideSettings.LABEL
		),
		HideSettings.LABEL
	);
	actionRegistry.registerWorkbenchAction(
		SyncActionDescriptor.create(
			HidePanel,
			HidePanel.ID,
			HidePanel.LABEL
		),
		HidePanel.LABEL
	);

	Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
		.registerWorkbenchContribution(ADSWebLite, LifecyclePhase.Restored);
}
