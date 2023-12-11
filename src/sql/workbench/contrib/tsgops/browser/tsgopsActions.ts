/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { localize } from 'vs/nls';
import { IWorkbenchLayoutService, Parts } from 'vs/workbench/services/layout/browser/layoutService';
import { IPaneCompositePartService } from 'vs/workbench/services/panecomposite/browser/panecomposite';
import { IViewDescriptorService } from 'vs/workbench/common/views';
import { Action2 } from 'vs/platform/actions/common/actions';
import { ServicesAccessor } from 'vs/editor/browser/editorExtensions';

export class HidePanel extends Action2 {
	static readonly ID = 'workbench.action.hidePanel';
	static readonly LABEL_ORG = 'Hide the panel';
	static readonly LABEL = localize('hidePanel', "Hide the panel");

	constructor() {
		super({
			id: HidePanel.ID,
			title: { value: HidePanel.LABEL, original: HidePanel.LABEL_ORG },
		});
	}

	run(accessor: ServicesAccessor): void {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		layoutService.setPartHidden(true, Parts.PANEL_PART);
	}
}

export class HideSettings extends Action2 {
	static readonly ID = 'workbench.action.hideSettings';
	static readonly LABEL_ORG = 'Hide the settings icon';
	static readonly LABEL = localize('hideSettings', "Hide the settings icon");

	constructor() {
		super({
			id: HideSettings.ID,
			title: { value: HideSettings.LABEL, original: HideSettings.LABEL_ORG },
		});
	}

	run(): void {
		let allActionItems = Array.from(document.getElementsByClassName('action-item icon'));
		let manageElement = allActionItems.filter((el) => el.getAttribute('aria-label') === 'Manage');
		manageElement[0].parentNode.removeChild(manageElement[0]);
	}
}

export class HideActivityBarViewContainers extends Action2 {
	static readonly ID = 'workbench.action.hideActivityBarViewContainers';
	static readonly LABEL_ORG = 'Hide the extension viewlet';
	static readonly LABEL = localize('hideActivityBarViewContainers', "Hide the extension viewlet");

	constructor() {
		super({
			id: HideActivityBarViewContainers.ID,
			title: { value: HideActivityBarViewContainers.LABEL, original: HideActivityBarViewContainers.LABEL_ORG },
		});
	}

	run(accessor: ServicesAccessor): void {
		const viewDescriptorService = accessor.get(IViewDescriptorService);
		const activityBarService = accessor.get(IPaneCompositePartService);

		let viewsToHide = ['workbench.view.search', 'workbench.view.explorer', 'workbench.view.scm', 'workbench.view.extensions'];
		for (let j = 0; j < viewsToHide.length; j++) {
			const viewContainer = viewDescriptorService.getViewContainerById(viewsToHide[j]);
			if (viewContainer) {
				activityBarService.hideActivePaneComposite(viewDescriptorService.getViewContainerLocation(viewContainer));
			}
		}
	}
}
