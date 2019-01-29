/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// import 'vs/css!./media/extensionsViewlet';
import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { isPromiseCanceledError, onUnexpectedError, create as createError } from 'vs/base/common/errors';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { Event as EventOf, Emitter, chain } from 'vs/base/common/event';
import { IAction } from 'vs/base/common/actions';
import { Separator } from 'vs/base/browser/ui/actionbar/actionbar';
import { KeyCode } from 'vs/base/common/keyCodes';
import { IViewlet } from 'vs/workbench/common/viewlet';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { append, $, addClass, removeClass, toggleClass, Dimension } from 'vs/base/browser/dom';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { LocalExtensionType, IExtensionManagementService, IExtensionManagementServerService, IExtensionManagementServer } from 'vs/platform/extensionManagement/common/extensionManagement';

import { OpenGlobalSettingsAction } from 'vs/workbench/parts/preferences/browser/preferencesActions';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IEditorGroupsService } from 'vs/workbench/services/group/common/editorGroupsService';
import Severity from 'vs/base/common/severity';
import { IActivityService, ProgressBadge, NumberBadge } from 'vs/workbench/services/activity/common/activity';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { inputForeground, inputBackground, inputBorder, inputPlaceholderForeground } from 'vs/platform/theme/common/colorRegistry';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ViewsRegistry, IViewDescriptor } from 'vs/workbench/common/views';
import { ViewContainerViewlet, IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IContextKeyService, ContextKeyExpr, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IAddedViewDescriptorRef } from 'vs/workbench/browser/parts/views/views';
import { ViewletPanel } from 'vs/workbench/browser/parts/views/panelViewlet';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { Query } from 'vs/workbench/parts/extensions/common/extensionQuery';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { IModelService } from 'vs/editor/common/services/modelService';
import { Range } from 'vs/editor/common/core/range';
import { Position } from 'vs/editor/common/core/position';
import { ITextModel } from 'vs/editor/common/model';
import { IEditorOptions } from 'vs/editor/common/config/editorOptions';
import { getSimpleEditorOptions } from 'vs/workbench/parts/codeEditor/electron-browser/simpleEditorOptions';
import { SuggestController } from 'vs/editor/contrib/suggest/suggestController';
import { ContextMenuController } from 'vs/editor/contrib/contextmenu/contextmenu';
import { MenuPreventer } from 'vs/workbench/parts/codeEditor/electron-browser/menuPreventer';
import { SnippetController2 } from 'vs/editor/contrib/snippet/snippetController2';
import { isMacintosh } from 'vs/base/common/platform';
import { ConnectionViewlet } from 'sql/workbench/parts/connection/electron-browser/connectionViewlet';
import { VIEWLET_ID, VIEW_CONTAINER } from 'sql/parts/dataExplorer/common/dataExplorer';
import { ViewletDescriptor, Viewlet } from 'vs/workbench/browser/viewlet';
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

	search(value: string): void {
		const event = new Event('input', { bubbles: true }) as SearchInputEvent;
		event.immediate = true;
	}

	private triggerSearch(immediate = false): void {
	}

	private normalizedQuery(): string {
		return '';
	}

	protected onDidAddViews(added: IAddedViewDescriptorRef[]): ViewletPanel[] {
		const addedViews = super.onDidAddViews(added);
		TPromise.join(addedViews.map(addedView => (<ExtensionsListView>addedView).show(this.normalizedQuery())));
		return addedViews;
	}

	protected createView(viewDescriptor: IViewDescriptor, options: IViewletViewOptions): ViewletPanel {
		if (viewDescriptor.id === 'dataExplorer.objectExplorer') {

		}
		return this.instantiationService.createInstance(viewDescriptor.ctor, options) as ViewletPanel;
	}

	private count(): number {
		return this.panels.reduce((count, view) => (<ExtensionsListView>view).count() + count, 0);
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