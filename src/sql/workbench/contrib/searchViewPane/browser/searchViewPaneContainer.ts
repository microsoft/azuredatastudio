/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/searchViewPane';
import { ViewPaneContainer, ViewPane } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { addClass, $, append, Dimension, toggleClass, getTotalHeight } from 'vs/base/browser/dom';
import { IAction } from 'vs/base/common/actions';
import { IViewletViewOptions } from 'vs/workbench/browser/parts/views/viewsViewlet';
import { IMenuService } from 'vs/platform/actions/common/actions';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IViewDescriptorService, IViewDescriptor } from 'vs/workbench/common/views';
import { ISearchWidgetService, ISearchViewPaneOptions } from 'sql/workbench/contrib/searchViewPane/browser/searchWidget/searchWidgetService';

export class SearchViewPaneContainer extends ViewPaneContainer {
	private root: HTMLElement;
	private searchSourcesBox: HTMLElement;
	private searchWidgetsContainerElement!: HTMLElement;

	constructor(
		private params: ISearchViewPaneOptions,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService configurationService: IConfigurationService,
		@IMenuService private menuService: IMenuService,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@ISearchWidgetService private searchWidgetSerivce: ISearchWidgetService
	) {
		super(params.VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService);
	}

	create(parent: HTMLElement): void {
		addClass(parent, 'search-view-pane');
		this.root = parent;

		this.searchWidgetsContainerElement = append(this.root, $('.header'));
		this.searchWidgetSerivce.registerSearchWidget(this.searchWidgetsContainerElement, this, this.params);

		this.searchSourcesBox = append(this.root, $('.searchSources'));

		return super.create(this.searchSourcesBox);
	}

	focus(): void {
		super.focus();
	}

	layout(dimension: Dimension): void {
		toggleClass(this.root, 'narrow', dimension.width <= 300);
		super.layout(new Dimension(dimension.width, dimension.height - getTotalHeight(this.searchWidgetsContainerElement)));
	}

	getOptimalWidth(): number {
		return 400;
	}

	getSecondaryActions(): IAction[] {
		let menu = this.menuService.createMenu(this.params.actionsMenuId, this.contextKeyService);
		let actions = [];
		menu.getActions({}).forEach(group => {
			if (group[0] === 'secondary') {
				actions.push(...group[1]);
			}
		});
		menu.dispose();
		return actions;
	}

	protected createView(viewDescriptor: IViewDescriptor, options: IViewletViewOptions): ViewPane {
		let viewletPanel = this.instantiationService.createInstance(viewDescriptor.ctorDescriptor.ctor, options) as ViewPane;
		this._register(viewletPanel);
		return viewletPanel;
	}
}
