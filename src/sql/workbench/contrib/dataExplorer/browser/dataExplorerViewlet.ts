/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { toggleClass, Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ConnectionViewletPanel } from 'sql/workbench/contrib/dataExplorer/browser/connectionViewletPanel';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewsRegistry, IViewContainersRegistry, ViewContainerLocation, IViewDescriptorService } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { Registry } from 'vs/platform/registry/common/platform';
import { ViewPane } from 'vs/workbench/browser/parts/views/viewPane';
import { ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { KeyCode, KeyMod } from 'vs/base/common/keyCodes';
import { SqlIconId } from 'sql/base/common/codicons';

export const VIEWLET_ID = 'workbench.view.connections';

export class DataExplorerViewletViewsContribution implements IWorkbenchContribution {

	constructor() {
		this.registerViews();
	}

	private registerViews(): void {
		let viewDescriptors = [];
		viewDescriptors.push(this.createObjectExplorerViewDescriptor());
		Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews(viewDescriptors, VIEW_CONTAINER);
	}

	private createObjectExplorerViewDescriptor(): IViewDescriptor {
		return {
			id: ConnectionViewletPanel.ID,
			name: localize('dataExplorer.servers', "Servers"),
			ctorDescriptor: new SyncDescriptor(ConnectionViewletPanel),
			weight: 100,
			canToggleVisibility: true,
			order: 0
		};
	}
}

export class DataExplorerViewPaneContainer extends ViewPaneContainer {
	private root?: HTMLElement;

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService configurationService: IConfigurationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService
	) {
		super(VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService);
	}

	override create(parent: HTMLElement): void {
		this.root = parent;

		super.create(parent);
		parent.classList.add('dataExplorer-viewlet');
	}

	override focus(): void {
	}

	override layout(dimension: Dimension): void {
		toggleClass(this.root!, 'narrow', dimension.width <= 300);
		super.layout(new Dimension(dimension.width, dimension.height));
	}

	override getOptimalWidth(): number {
		return 400;
	}

	protected override createView(viewDescriptor: IViewDescriptor, options: IViewletViewOptions): ViewPane {
		let viewletPanel = this.instantiationService.createInstance(viewDescriptor.ctorDescriptor.ctor, options) as ViewPane;
		this._register(viewletPanel);
		return viewletPanel;
	}
}

export const VIEW_CONTAINER = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: VIEWLET_ID,
	title: localize('dataexplorer.name', "Connections"),
	ctorDescriptor: new SyncDescriptor(DataExplorerViewPaneContainer),
	openCommandActionDescriptor: {
		id: VIEWLET_ID,
		mnemonicTitle: localize('showDataExplorer', "Show Connections"),
		keybindings: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KEY_D },
		order: 0
	},
	icon: { id: SqlIconId.dataExplorer },
	order: 0,
	storageId: `${VIEWLET_ID}.state`
}, ViewContainerLocation.Sidebar, { isDefault: true });
