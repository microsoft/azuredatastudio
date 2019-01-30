/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IAction } from 'vs/base/common/actions';
import { IViewlet } from 'vs/workbench/common/viewlet';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { append, $, addClass, toggleClass, Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IExtensionManagementService, IExtensionManagementServerService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ViewsRegistry, IViewDescriptor } from 'vs/workbench/common/views';
import { ViewContainerViewlet, IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IAddedViewDescriptorRef } from 'vs/workbench/browser/parts/views/views';
import { ViewletPanel } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IModelService } from 'vs/editor/common/services/modelService';
import { VIEWLET_ID, VIEW_CONTAINER } from 'sql/parts/dataExplorer/common/dataExplorerExtensionPoint';
import { ExtensionsListView } from 'vs/workbench/parts/extensions/electron-browser/extensionsViews';
import { ConnectionViewletPanel } from 'sql/parts/dataExplorer/objectExplorer/viewlet/connectionViewletPanel';

interface SearchInputEvent extends Event {
	target: HTMLInputElement;
	immediate?: boolean;
}

export class DataExplorerViewletViewsContribution implements IWorkbenchContribution {

	constructor(
		@IExtensionManagementServerService private extensionManagementServerService: IExtensionManagementServerService
	) {
		this.registerViews();
	}

	private registerViews(): void {
		let viewDescriptors = [];
		viewDescriptors.push(this.createObjectExplorerViewDescriptor());
		viewDescriptors.push(this.createObjectExplorerViewDescriptor2());
		ViewsRegistry.registerViews(viewDescriptors);
	}

	private createObjectExplorerViewDescriptor(): IViewDescriptor {
		return {
			id: 'dataExplorer.servers',
			name: localize('dataExplorer.servers', "Servers"),
			container: VIEW_CONTAINER,
			ctor: ConnectionViewletPanel,
			weight: 100,
			canToggleVisibility: true,
			order: 1
		};
	}

	private createObjectExplorerViewDescriptor2(): IViewDescriptor {
		return {
			id: 'dataExplorer.objectExplorer2',
			name: localize('objectExplorer2', "Object Explorer2"),
			container: VIEW_CONTAINER,
			ctor: ExtensionsListView,
			weight: 100,
			order: 2
		};
	}
}

export class DataExplorerViewlet extends ViewContainerViewlet  {
	private root: HTMLElement;

	private dataSourcesBox: HTMLElement;
	private primaryActions: IAction[];
	private disposables: IDisposable[] = [];

	constructor(
		@IPartService partService: IPartService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IProgressService private progressService: IProgressService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IEditorGroupsService private editorGroupService: IEditorGroupsService,
		@IExtensionManagementService private extensionManagementService: IExtensionManagementService,
		@INotificationService private notificationService: INotificationService,
		@IViewletService private viewletService: IViewletService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IModelService private modelService: IModelService,
	) {
		super(VIEWLET_ID, `${VIEWLET_ID}.state`, true, partService, telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService);
		this.disposables.push(this.viewletService.onDidViewletOpen(this.onViewletOpen, this, this.disposables));
	}

	create(parent: HTMLElement): TPromise<void> {
		addClass(parent, 'dataExplorer-viewlet');
		this.root = parent;

		this.dataSourcesBox = append(this.root, $('.dataSources'));

		return super.create(this.dataSourcesBox);
	}

	public updateStyles(): void {
		super.updateStyles();
	}

	setVisible(visible: boolean): TPromise<void> {
		const isVisibilityChanged = this.isVisible() !== visible;
		return super.setVisible(visible).then(() => {
			if (isVisibilityChanged) {
				if (visible) {
				}
			}
		});
	}

	focus(): void {
	}

	layout(dimension: Dimension): void {
		toggleClass(this.root, 'narrow', dimension.width <= 300);

		super.layout(new Dimension(dimension.width, dimension.height - 38));
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
		TPromise.join(addedViews);
		return addedViews;
	}

	protected createView(viewDescriptor: IViewDescriptor, options: IViewletViewOptions): ViewletPanel {
		if (viewDescriptor.id === 'dataExplorer.objectExplorer') {

		}
		return this.instantiationService.createInstance(viewDescriptor.ctor, options) as ViewletPanel;
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