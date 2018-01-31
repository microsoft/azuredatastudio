/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/newDashboardTabDialog';
import * as DOM from 'vs/base/browser/dom';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { IListService } from 'vs/platform/list/browser/listService';
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
import { IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import * as TelemetryKeys from 'sql/common/telemetryKeys';
import { SplitView } from 'sql/base/browser/ui/splitview/splitview';

class ExtensionListDelegate implements IDelegate<IDashboardTab> {

	constructor(
		private _height: number
	) {
	}

	public getHeight(element: IDashboardTab): number {
		return this._height;
	}

	public getTemplateId(element: IDashboardTab): string {
		return 'extensionListRenderer';
	}
}

interface ExtensionListTemplate {
	root: HTMLElement;
	title: HTMLElement;
	description: HTMLElement;
	publisher: HTMLElement;
}

class ExtensionListRenderer implements IRenderer<IDashboardTab, ExtensionListTemplate> {
	public static TEMPLATE_ID = 'extensionListRenderer';

	public get templateId(): string {
		return ExtensionListRenderer.TEMPLATE_ID;
	}

	public renderTemplate(container: HTMLElement): ExtensionListTemplate {
		const tableTemplate: ExtensionListTemplate = Object.create(null);
		tableTemplate.root = DOM.append(container, DOM.$('div.list-row.extensionTab-list'));
		tableTemplate.title = DOM.append(tableTemplate.root, DOM.$('div.title'));
		tableTemplate.description = DOM.append(tableTemplate.root, DOM.$('div.description'));
		tableTemplate.publisher = DOM.append(tableTemplate.root, DOM.$('div.publisher'));
		return tableTemplate;
	}

	public renderElement(dashboardTab: IDashboardTab, index: number, templateData: ExtensionListTemplate): void {
		templateData.title.innerText = dashboardTab.title;
		templateData.description.innerText = dashboardTab.description;
		templateData.publisher.innerText = dashboardTab.publisher;
	}

	public disposeTemplate(template: ExtensionListTemplate): void {
		// noop
	}
}

export class NewDashboardTabDialog extends Modal {
	public static EXTENSIONLIST_HEIGHT = 84;

	// MEMBER VARIABLES ////////////////////////////////////////////////////
	private _addNewTabButton: Button;
	private _cancelButton: Button;
	private _extensionList: List<IDashboardTab>;
	private _extensionTabView: FixedListView<IDashboardTab>;
	private _splitView: SplitView;
	private _container: HTMLElement;

	// EVENTING ////////////////////////////////////////////////////////////
	private _onAddTabs: Emitter<Array<IDashboardTab>>;
	public get onAddTabs(): Event<Array<IDashboardTab>> { return this._onAddTabs.event; }

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
			localize('addFeatureTab', 'Add feature tab'),
			TelemetryKeys.AddNewDashboardTab,
			partService,
			telemetryService,
			contextKeyService,
			{ hasSpinner: true }
		);

		// Setup the event emitters
		this._onAddTabs = new Emitter<IDashboardTab[]>();
		this._onCancel = new Emitter<void>();
	}

	// MODAL OVERRIDE METHODS //////////////////////////////////////////////
	protected layout(height?: number): void {
		// Ignore height as it's a subcomponent being laid out
		this._splitView.layout(DOM.getContentHeight(this._container));
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		this._addNewTabButton = this.addFooterButton(localize('add', 'Add'), () => this.addNewTabs());
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
		this._extensionList = new List<IDashboardTab>(extensionTabViewContainer, delegate, [extensionTabRenderer]);
		this._extensionTabView = new FixedListView<IDashboardTab>(
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
		this._register(this._listService.register(this._extensionList));
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
		let selectedTabs = this._extensionList.getSelectedElements();
		this._onAddTabs.fire(selectedTabs);
	}

	public cancel() {
		this.hide();
	}

	public open(dashboardTabs: Array<IDashboardTab>) {
		this.show();
		this._extensionTabView.updateList(dashboardTabs);
		this.layout();
		if (this._extensionList.length > 0) {
			this._extensionList.setSelection([0]);
		}
		this._addNewTabButton.focus();
	}

	public dispose(): void {
		super.dispose();
	}
}
