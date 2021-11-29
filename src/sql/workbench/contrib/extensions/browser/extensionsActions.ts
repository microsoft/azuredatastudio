/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
//import { ICommandService } from 'vs/platform/commands/common/commands';
//import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
//import { ICompositeBar } from 'vs/workbench/browser/parts/compositeBarActions';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IExtensionsWorkbenchService, VIEWLET_ID, IExtensionsViewPaneContainer } from 'vs/workbench/contrib/extensions/common/extensions';
import { IExtensionRecommendation } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { URI } from 'vs/base/common/uri';
import { CancellationToken } from 'vs/base/common/cancellation';
import { PagedModel } from 'vs/base/common/paging';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IActivityBarService } from 'vs/workbench/services/activityBar/browser/activityBarService';
//import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
//import { IContextViewService } from 'vs/platform/contextview/browser/contextView';


//import { CompositeBar } from 'vs/workbench/browser/parts/compositeBar';
//import { ICompositeBar } from 'vs/workbench/browser/parts/compositeBarActions';

function getScenarioID(scenarioType: string) {
	return 'workbench.extensions.action.show' + scenarioType;
}

export class ShowRecommendedExtensionsByScenarioAction extends Action {
	constructor(
		private readonly scenarioType: string,
		@IViewletService private readonly viewletService: IViewletService
	) {
		super(getScenarioID(scenarioType), localize('showRecommendations', "Show Recommendations"), undefined, true);
	}

	override run(): Promise<void> {
		return this.viewletService.openViewlet(VIEWLET_ID, true)
			.then(viewlet => viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer)
			.then(viewlet => {
				viewlet.search('@' + this.scenarioType);
				viewlet.focus();
			});
	}
}

export class InstallRecommendedExtensionsByScenarioAction extends Action {
	private _recommendations: IExtensionRecommendation[] = [];
	get recommendations(): IExtensionRecommendation[] { return this._recommendations; }
	set recommendations(recommendations: IExtensionRecommendation[]) { this._recommendations = recommendations; this.enabled = this._recommendations.length > 0; }

	constructor(
		private readonly scenarioType: string,
		recommendations: IExtensionRecommendation[],
		@IViewletService private readonly viewletService: IViewletService,
		@IExtensionsWorkbenchService private readonly extensionWorkbenchService: IExtensionsWorkbenchService
	) {
		super(getScenarioID(scenarioType), localize('Install Extensions', "Install Extensions"), 'extension-action');
		this.recommendations = recommendations;
	}

	override async run(): Promise<void> {
		if (!this.recommendations.length) { return; }
		const viewlet = await this.viewletService.openViewlet(VIEWLET_ID, true);
		const viewPaneContainer = viewlet?.getViewPaneContainer() as IExtensionsViewPaneContainer;
		viewPaneContainer.search('@' + this.scenarioType);
		viewlet.focus();
		const names = this.recommendations.map(({ extensionId }) => extensionId);
		const pager = await this.extensionWorkbenchService.queryGallery({ names, source: 'install-' + this.scenarioType }, CancellationToken.None);
		let installPromises: Promise<any>[] = [];
		let model = new PagedModel(pager);
		for (let i = 0; i < pager.total; i++) {
			installPromises.push(model.resolve(i, CancellationToken.None).then(e => this.extensionWorkbenchService.install(e)));
		}
		await Promise.all(installPromises);
	}
}

export class OpenExtensionAuthoringDocsAction extends Action {

	static readonly ID = 'workbench.extensions.action.openExtensionAuthoringDocs';
	static readonly LABEL = localize('openExtensionAuthoringDocs', "Author an Extension...");
	private static readonly extensionAuthoringDocsURI = 'https://docs.microsoft.com/sql/azure-data-studio/extension-authoring';

	constructor(
		id: string = OpenExtensionAuthoringDocsAction.ID,
		label: string = OpenExtensionAuthoringDocsAction.LABEL,
		@IOpenerService private readonly openerService: IOpenerService,
	) {
		super(id, label);
	}

	override async run(): Promise<void> {
		await this.openerService.open(URI.parse(OpenExtensionAuthoringDocsAction.extensionAuthoringDocsURI));
	}
}

export class HidePanel extends Action {
	static readonly ID = 'workbench.extensions.action.hidePanel';
	static readonly LABEL = localize('hidePanel', "Hide the panel...");

	constructor(
		id: string = HideExtensionMenu.ID,
		label: string = HideExtensionMenu.LABEL,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
	) {
		super(id, label, 'panel');
	}

	override async run(): Promise<void> {
		this.layoutService.setPanelHidden(true);
	}
}

export class HideSettings extends Action {
	static readonly ID = 'workbench.extensions.action.hideSettings';
	static readonly LABEL = localize('hideSettings', "Hide the settings icon...");

	constructor(
		id: string = HideExtensionMenu.ID,
		label: string = HideExtensionMenu.LABEL,
	) {
		super(id, label);
	}

	override async run(): Promise<void> {
		let allActionItems = Array.from(document.getElementsByClassName('action-item icon'));
		let manageElement = allActionItems.filter((el) => el.getAttribute('aria-label') === 'Manage');
		manageElement[0].parentNode.removeChild(manageElement[0]);
	}
}


export class HideExtensionMenu extends Action {
	static readonly ID = 'workbench.extensions.action.hideExtensionsMenu';
	static readonly LABEL = localize('hideExtensionsMenu', "Hide the extension viewlet...");

	constructor(
		id: string = HideExtensionMenu.ID,
		label: string = HideExtensionMenu.LABEL,
		//private compositeBar: ICompositeBar
		//@ICommandService private readonly commandService: ICommandService,
		@IActivityBarService private readonly activityBarService: IActivityBarService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService
		//@IContextViewService private readonly contextViewService: IContextViewService
	) {
		super(id, label, 'panel');
	}

	override async run(): Promise<void> {
		//this.panelService.getPinnedViewContainerIds();
		this.activityBarService.getVisibleViewContainerIds();
		this.layoutService.setSideBarHidden(true);
		let array = ['Search', 'Explorer', 'Source Control', 'Extensions'];
		let uiElement = document.querySelector('[aria-label="Active View Switcher"]');
		let childRemoveIndices = [];
		for (let i = 0; i < uiElement.children.length; i++) {
			let aria = uiElement.children[i].getAttribute('aria-label');
			for (let j = 0; j < array.length; j++) {
				if (aria.includes(array[j])) {
					childRemoveIndices.push(i);
				}
			}
		}

		for (let i = childRemoveIndices.length - 1; i >= 0; i--) {
			uiElement.removeChild(uiElement.children[childRemoveIndices[i]]);
		}

		//await this.commandService.executeCommand('workbench.view.extensions');
		//this.compositeBar.unpin('workbench.view.extensions');

		//let bottomPanel = document.getElementById('workbench.parts.panel');
		//bottomPanel.parentNode.removeChild(bottomPanel);
	}
}
