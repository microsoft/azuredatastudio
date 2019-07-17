/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IAction, Action } from 'vs/base/common/actions';
import { ShowViewletAction } from 'vs/workbench/browser/viewlet';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { IExtension, ExtensionState, IExtensionsWorkbenchService, VIEWLET_ID, IExtensionsViewlet, AutoUpdateConfigurationKey, IExtensionContainer, EXTENSIONS_CONFIG, ExtensionsPolicy, ExtensionsPolicyKey } from 'vs/workbench/contrib/extensions/common/extensions';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionRecommendation, IExtensionManagementServerService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { CancellationToken } from 'vs/base/common/cancellation';
import { PagedModel } from 'vs/base/common/paging';
import { IConfigurationService, ConfigurationTarget } from 'vs/platform/configuration/common/configuration';

export class ShowVisualizerExtensionsAction extends Action {

	static readonly ID = 'workbench.extensions.action.showVisualizerExtensions';
	static LABEL = localize('showVisualizerExtensions', "Show Visualizers");

	constructor(
		id: string,
		label: string,
		@IViewletService private readonly viewletService: IViewletService
	) {
		super(id, label, undefined, true);
	}

	run(): Promise<void> {
		return this.viewletService.openViewlet(VIEWLET_ID, true)
			.then(viewlet => viewlet as IExtensionsViewlet)
			.then(viewlet => {
				viewlet.search('@visualizerExtensions');
				viewlet.focus();
			});
	}
}

export class InstallVisualizerExtensionsAction extends Action {

	static readonly ID = 'workbench.extensions.action.installVisualizerExtensions';
	static LABEL = localize('installVisualizerExtensions', "Install Visualizer Extensions");

	private _recommendations: IExtensionRecommendation[] = [];
	get recommendations(): IExtensionRecommendation[] { return this._recommendations; }
	set recommendations(recommendations: IExtensionRecommendation[]) { this._recommendations = recommendations; this.enabled = this._recommendations.length > 0; }

	constructor(
		id: string = InstallVisualizerExtensionsAction.ID,
		label: string = InstallVisualizerExtensionsAction.LABEL,
		recommendations: IExtensionRecommendation[],
		@IViewletService private readonly viewletService: IViewletService,
		@INotificationService private readonly notificationService: INotificationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IExtensionsWorkbenchService private readonly extensionWorkbenchService: IExtensionsWorkbenchService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExtensionManagementServerService private readonly extensionManagementServerService: IExtensionManagementServerService
	) {
		super(id, label, 'extension-action');
		this.recommendations = recommendations;
	}

	run(): Promise<any> {
		return this.viewletService.openViewlet(VIEWLET_ID, true)
			.then(viewlet => viewlet as IExtensionsViewlet)
			.then(viewlet => {
				viewlet.search('@visualizerExtensions');
				viewlet.focus();
				const names = this.recommendations.map(({ extensionId }) => extensionId);
				return this.extensionWorkbenchService.queryGallery({ names, source: 'install-visualizer-extensions' }, CancellationToken.None).then(pager => {
					let installPromises: Promise<any>[] = [];
					let model = new PagedModel(pager);
					for (let i = 0; i < pager.total; i++) {
						installPromises.push(model.resolve(i, CancellationToken.None).then(e =>
							this.extensionWorkbenchService.install(e)
						));
					}
					return Promise.all(installPromises);
				});
			});
	}
}