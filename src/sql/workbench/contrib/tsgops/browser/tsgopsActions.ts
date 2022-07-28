/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';

import { IWorkbenchLayoutService, Parts } from 'vs/workbench/services/layout/browser/layoutService';
// import { IActivityBarService } from 'vs/workbench/services/activityBar/browser/activityBarService';
import { IPaneCompositePartService } from 'vs/workbench/services/panecomposite/browser/panecomposite';
import { IViewDescriptorService } from 'vs/workbench/common/views';

export class HidePanel extends Action {
	static readonly ID = 'workbench.action.hidePanel';
	static readonly LABEL = localize('hidePanel', "Hide the panel");

	constructor(
		id: string = HidePanel.ID,
		label: string = HidePanel.LABEL,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		super(id, label);
	}

	override async run(): Promise<void> {
		this.layoutService.setPartHidden(true, Parts.PANEL_PART);
	}
}

export class HideSettings extends Action {
	static readonly ID = 'workbench.action.hideSettings';
	static readonly LABEL = localize('hideSettings', "Hide the settings icon");

	constructor(
		id: string = HideSettings.ID,
		label: string = HideSettings.LABEL,
	) {
		super(id, label);
	}

	override async run(): Promise<void> {
		let allActionItems = Array.from(document.getElementsByClassName('action-item icon'));
		let manageElement = allActionItems.filter((el) => el.getAttribute('aria-label') === 'Manage');
		manageElement[0].parentNode.removeChild(manageElement[0]);
	}
}

export class HideActivityBarViewContainers extends Action {
	static readonly ID = 'workbench.action.hideActivityBarViewContainers';
	static readonly LABEL = localize('hideActivityBarViewContainers', "Hide the extension viewlet");

	constructor(
		id: string = HideActivityBarViewContainers.ID,
		label: string = HideActivityBarViewContainers.LABEL,
		@IViewDescriptorService private readonly viewDescriptorService: IViewDescriptorService,
		@IPaneCompositePartService private readonly activityBarService: IPaneCompositePartService,
	) {
		super(id, label);
	}

	override async run(): Promise<void> {
		let viewsToHide = ['workbench.view.search', 'workbench.view.explorer', 'workbench.view.scm', 'workbench.view.extensions'];
		for (let j = 0; j < viewsToHide.length; j++) {
			const viewContainer = this.viewDescriptorService.getViewContainerById(viewsToHide[j]);
			if (viewContainer) {
				this.activityBarService.hideActivePaneComposite(this.viewDescriptorService.getViewContainerLocation(viewContainer));
			}
		}
	}
}
