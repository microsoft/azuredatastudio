/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from 'vs/base/common/lifecycle';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';

class ContextMenuContribution implements IWorkbenchContribution {

	private readonly disposables = new DisposableStore();

	constructor(
		@ILayoutService layoutService: ILayoutService,
		@IContextMenuService contextMenuService: IContextMenuService
	) {
		const update = (visible: boolean) => layoutService.container.classList.toggle('context-menu-visible', visible);
		contextMenuService.onDidShowContextMenu(() => update(true), null, this.disposables);
		contextMenuService.onDidHideContextMenu(() => update(false), null, this.disposables);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench)
	.registerWorkbenchContribution(ContextMenuContribution, LifecyclePhase.Eventually);
