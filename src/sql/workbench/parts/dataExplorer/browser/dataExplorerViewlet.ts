/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { localize } from 'vs/nls';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IAction } from 'vs/base/common/actions';
import { IViewlet } from 'vs/workbench/common/viewlet';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { append, $, addClass, toggleClass, Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { ViewContainerViewlet, IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IAddedViewDescriptorRef } from 'vs/workbench/browser/parts/views/views';
import { ViewletPanel } from 'vs/workbench/browser/parts/views/panelViewlet';
import { VIEWLET_ID, VIEW_CONTAINER } from 'sql/workbench/parts/dataExplorer/browser/dataExplorerExtensionPoint';
import { ConnectionViewletPanel } from 'sql/workbench/parts/dataExplorer/browser/connectionViewletPanel';
import { Extensions as ViewContainerExtensions, IViewDescriptor, IViewsRegistry } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { Registry } from 'vs/platform/registry/common/platform';

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
			id: 'dataExplorer.servers',
			name: localize('dataExplorer.servers', "Servers"),
			ctorDescriptor: { ctor: ConnectionViewletPanel },
			weight: 100,
			canToggleVisibility: true,
			order: 0
		};
	}
}

export class DataExplorerViewlet extends ViewContainerViewlet {
	private root: HTMLElement;

	private dataSourcesBox: HTMLElement;
	private primaryActions: IAction[];
	private disposables: IDisposable[] = [];

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewletService private viewletService: IViewletService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(VIEWLET_ID, `${VIEWLET_ID}.state`, true, configurationService, layoutService, telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService);
		this.disposables.push(this.viewletService.onDidViewletOpen(this.onViewletOpen, this, this.disposables));
	}

	create(parent: HTMLElement): void {
		addClass(parent, 'dataExplorer-viewlet');
		this.root = parent;

		this.dataSourcesBox = append(this.root, $('.dataSources'));

		return super.create(this.dataSourcesBox);
	}

	public updateStyles(): void {
		super.updateStyles();
	}

	focus(): void {
	}

	layout(dimension: Dimension): void {
		toggleClass(this.root, 'narrow', dimension.width <= 300);
		super.layout(new Dimension(dimension.width, dimension.height));
	}

	getOptimalWidth(): number {
		return 400;
	}

	getActions(): IAction[] {
		if (!this.primaryActions) {
			this.primaryActions = [];
		}
		return [];
	}

	getSecondaryActions(): IAction[] {
		return [];
	}

	protected onDidAddViews(added: IAddedViewDescriptorRef[]): ViewletPanel[] {
		const addedViews = super.onDidAddViews(added);
		Promise.all(addedViews);
		return addedViews;
	}

	protected createView(viewDescriptor: IViewDescriptor, options: IViewletViewOptions): ViewletPanel {
		return this.instantiationService.createInstance(viewDescriptor.ctorDescriptor.ctor, options) as ViewletPanel;
	}

	private onViewletOpen(viewlet: IViewlet): void {
		if (!viewlet || viewlet.getId() === VIEWLET_ID) {
			return;
		}
	}

	dispose(): void {
		this.disposables = dispose(this.disposables);
		super.dispose();
	}
}
