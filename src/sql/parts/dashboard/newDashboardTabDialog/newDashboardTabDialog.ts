/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/newDashboardTabDialog';
import * as DOM from 'vs/base/browser/dom';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IListService, ListService } from 'vs/platform/list/browser/listService';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import Event, { Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IDelegate, IRenderer } from 'vs/base/browser/ui/list/list';

import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/base/browser/ui/modal/modal';
import { attachModalDialogStyler, attachButtonStyler } from 'sql/common/theme/styler';
import { FixedListView } from 'sql/platform/views/fixedListView';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import { SplitView } from 'sql/base/browser/ui/splitview/splitview';
import { NewDashboardTabViewModel, IDashboardUITab } from 'sql/parts/dashboard/newDashboardTabDialog/newDashboardTabViewModel';
import { IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';

class ExtensionListDelegate implements IDelegate<IDashboardUITab> {

	constructor(
		private _height: number
	) {
	}

	public getHeight(element: IDashboardUITab): number {
		return this._height;
	}

	public getTemplateId(element: IDashboardUITab): string {
		return 'extensionListRenderer';
	}
}

interface ExtensionListTemplate {
	root: HTMLElement;
	icon: HTMLElement;
	title: HTMLElement;
	description: HTMLElement;
	publisher: HTMLElement;
}

class ExtensionListRenderer implements IRenderer<IDashboardUITab, ExtensionListTemplate> {
	public static TEMPLATE_ID = 'extensionListRenderer';
	private static readonly OPENED_TAB_CLASS = 'success';
	private static readonly ICON_CLASS = 'extension-status-icon icon';

	public get templateId(): string {
		return ExtensionListRenderer.TEMPLATE_ID;
	}

	public renderTemplate(container: HTMLElement): ExtensionListTemplate {
		const tableTemplate: ExtensionListTemplate = Object.create(null);
		tableTemplate.root = DOM.append(container, DOM.$('div.list-row.extensionTab-list'));
		tableTemplate.icon = DOM.append(tableTemplate.root, DOM.$('div.icon'));
		var titleContainer = DOM.append(tableTemplate.root, DOM.$('div.extension-details'));
		tableTemplate.title = DOM.append(titleContainer, DOM.$('div.title'));
		tableTemplate.description = DOM.append(titleContainer, DOM.$('div.description'));
		tableTemplate.publisher = DOM.append(titleContainer, DOM.$('div.publisher'));
		return tableTemplate;
	}

	public renderElement(dashboardTab: IDashboardUITab, index: number, templateData: ExtensionListTemplate): void {
		templateData.icon.className = ExtensionListRenderer.ICON_CLASS;
		if (dashboardTab.isOpened) {
			templateData.icon.classList.add(ExtensionListRenderer.OPENED_TAB_CLASS);
		}
		templateData.title.innerText = dashboardTab.tabConfig.title;
		templateData.description.innerText = dashboardTab.tabConfig.description;
		templateData.publisher.innerText = dashboardTab.tabConfig.publisher;
	}

	public disposeTemplate(template: ExtensionListTemplate): void {
		// noop
	}
}

export class NewDashboardTabDialog extends Modal {
	public static EXTENSIONLIST_HEIGHT = 101;

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _addNewTabButton: Button;
	private _cancelButton: Button;
	private _extensionList: List<IDashboardUITab>;
	private _extensionTabView: FixedListView<IDashboardUITab>;
	private _splitView: SplitView;
	private _container: HTMLElement;

	private _viewModel: NewDashboardTabViewModel;

	// EVENTING ////////////////////////////////////////////////////////////
	private _onAddTabs: Emitter<Array<IDashboardUITab>>;
	public get onAddTabs(): Event<Array<IDashboardUITab>> { return this._onAddTabs.event; }

	private _onCancel: Emitter<void>;
	public get onCancel(): Event<void> { return this._onCancel.event; }

	constructor(
		@IPartService partService: IPartService,
		@IThemeService private _themeService: IThemeService,
		@IListService private _listService: IListService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IKeybindingService private _keybindingService: IKeybindingService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(
			localize('openInstalledFeatures', 'Open installed features'),
			TelemetryKeys.AddNewDashboardTab,
			partService,
			telemetryService,
			contextKeyService,
			{ hasSpinner: true }
		);

		// Setup the event emitters
		this._onAddTabs = new Emitter<IDashboardUITab[]>();
		this._onCancel = new Emitter<void>();

		this._viewModel = new NewDashboardTabViewModel();
		this._register(this._viewModel.updateTabListEvent(tabs => this.onUpdateTabList(tabs)));
	}

	// MODAL OVERRIDE METHODS //////////////////////////////////////////////
	protected layout(height?: number): void {
		// Ignore height as it's a subcomponent being laid out
		this._splitView.layout(DOM.getContentHeight(this._container));
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		this._addNewTabButton = this.addFooterButton(localize('ok', 'OK'), () => this.addNewTabs());
		this._cancelButton = this.addFooterButton(localize('cancel', 'Cancel'), () => this.cancel());
		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
		this._container = container;
		let viewBody = DOM.$('div.extension-view');
		DOM.append(container, viewBody);
		this._splitView = new SplitView(viewBody);

		// Create a fixed list view for the account provider
		let extensionTabViewContainer = DOM.$('.extensionTab-view');
		let delegate = new ExtensionListDelegate(NewDashboardTabDialog.EXTENSIONLIST_HEIGHT);
		let extensionTabRenderer = new ExtensionListRenderer();
		this._extensionList = new List<IDashboardUITab>(extensionTabViewContainer, delegate, [extensionTabRenderer]);
		this._extensionTabView = new FixedListView<IDashboardUITab>(
			undefined,
			false,
			localize('allFeatures', 'All features'),
			this._extensionList,
			extensionTabViewContainer,
			22,
			[],
			undefined,
			this._contextMenuService,
			this._keybindingService,
			this._themeService
		);

		// Append the list view to the split view
		this._splitView.addView(this._extensionTabView);
		this._register(attachListStyler(this._extensionList, this._themeService));

		let listService = <ListService>this._listService;
		this._register(listService.register(this._extensionList));
		this._splitView.layout(DOM.getContentHeight(this._container));
	}

	private registerListeners(): void {
		// Theme styler
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
		this._register(attachButtonStyler(this._addNewTabButton, this._themeService));
	}

	/* Overwrite escape key behavior */
	protected onClose() {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected onAccept() {
		this.addNewTabs();
	}

	public close() {
		this.hide();
	}

	private addNewTabs() {
		if (this._addNewTabButton.enabled) {
			let selectedTabs = this._extensionList.getSelectedElements();
			this._onAddTabs.fire(selectedTabs);
		}
	}

	public cancel() {
		this.hide();
	}

	public open(dashboardTabs: Array<IDashboardTab>, openedTabs: Array<IDashboardTab>) {
		this.show();
		this._viewModel.updateDashboardTabs(dashboardTabs, openedTabs);
	}

	private onUpdateTabList(tabs: IDashboardUITab[]) {
		this._extensionTabView.updateList(tabs);
		this.layout();
		if (this._extensionList.length > 0) {
			this._extensionList.setSelection([0]);
			this._addNewTabButton.enabled = true;
			this._addNewTabButton.focus();
		} else {
			this._addNewTabButton.enabled = false;
			this._cancelButton.focus();
		}
	}

	public dispose(): void {
		super.dispose();
	}
}
