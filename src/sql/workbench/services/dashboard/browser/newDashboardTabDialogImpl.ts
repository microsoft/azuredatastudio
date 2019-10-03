/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!sql/media/icons/common-icons';
import 'vs/css!./media/newDashboardTabDialog';

import * as DOM from 'vs/base/browser/dom';
import { List } from 'vs/base/browser/ui/list/listWidget';
import { Event, Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachListStyler } from 'vs/platform/theme/common/styler';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IListVirtualDelegate, IListRenderer } from 'vs/base/browser/ui/list/list';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { attachModalDialogStyler, attachButtonStyler } from 'sql/platform/theme/common/styler';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { NewDashboardTabViewModel, IDashboardUITab } from 'sql/workbench/services/dashboard/browser/newDashboardTabViewModel';
import { IDashboardTab } from 'sql/platform/dashboard/browser/dashboardRegistry';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { ILogService } from 'vs/platform/log/common/log';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/resourceConfiguration';

class ExtensionListDelegate implements IListVirtualDelegate<IDashboardUITab> {

	private static readonly HEIGHT = 101;

	public getHeight(element: IDashboardUITab): number {
		return ExtensionListDelegate.HEIGHT;
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

class ExtensionListRenderer implements IListRenderer<IDashboardUITab, ExtensionListTemplate> {
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
		let titleContainer = DOM.append(tableTemplate.root, DOM.$('div.extension-details'));
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

	public disposeElement(element: IDashboardUITab, index: number, templateData: ExtensionListTemplate): void {
		// noop
	}
}

export class NewDashboardTabDialog extends Modal {

	// MEMBER letIABLES ////////////////////////////////////////////////////
	private _addNewTabButton: Button;
	private _cancelButton: Button;
	private _extensionList: List<IDashboardUITab>;
	private _extensionViewContainer: HTMLElement;
	private _noExtensionViewContainer: HTMLElement;

	private _viewModel: NewDashboardTabViewModel;

	// EVENTING ////////////////////////////////////////////////////////////
	private _onAddTabs: Emitter<Array<IDashboardUITab>>;
	public get onAddTabs(): Event<Array<IDashboardUITab>> { return this._onAddTabs.event; }

	private _onCancel: Emitter<void>;
	public get onCancel(): Event<void> { return this._onCancel.event; }

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IThemeService themeService: IThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(
			localize('newDashboardTab.openDashboardExtensions', "Open dashboard extensions"),
			TelemetryKeys.AddNewDashboardTab,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
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
		this._extensionList.layout(height);
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		this._addNewTabButton = this.addFooterButton(localize('newDashboardTab.ok', "OK"), () => this.addNewTabs());
		this._cancelButton = this.addFooterButton(localize('newDashboardTab.cancel', "Cancel"), () => this.cancel());
		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
		this._extensionViewContainer = DOM.$('div.extension-view');
		DOM.append(container, this._extensionViewContainer);

		this.createExtensionList(this._extensionViewContainer);
		this._noExtensionViewContainer = DOM.$('.no-extension-view');
		let noExtensionTitle = DOM.append(this._noExtensionViewContainer, DOM.$('.no-extensionTab-label'));
		let noExtensionLabel = localize('newdashboardTabDialog.noExtensionLabel', "No dashboard extensions are installed at this time. Go to Extension Manager to explore recommended extensions.");
		noExtensionTitle.textContent = noExtensionLabel;

		DOM.append(container, this._noExtensionViewContainer);
	}

	private createExtensionList(container: HTMLElement) {
		// Create a fixed list view for the extensions
		let extensionTabViewContainer = DOM.$('.extensionTab-view');
		let delegate = new ExtensionListDelegate();
		let extensionTabRenderer = new ExtensionListRenderer();
		this._extensionList = new List<IDashboardUITab>('NewDashboardTabExtentionList', extensionTabViewContainer, delegate, [extensionTabRenderer]);

		this._extensionList.onMouseDblClick(e => this.onAccept());
		this._extensionList.onKeyDown(e => {
			let event = new StandardKeyboardEvent(e);
			if (event.equals(KeyCode.Enter)) {
				this.onAccept();
			} else if (event.equals(KeyCode.Escape)) {
				this.onClose();
			}
		});

		DOM.append(container, extensionTabViewContainer);

		this._register(attachListStyler(this._extensionList, this._themeService));
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
		this._extensionList.splice(0, this._extensionList.length, tabs);
		this.layout();
		if (this._extensionList.length > 0) {
			this._extensionViewContainer.hidden = false;
			this._noExtensionViewContainer.hidden = true;
			this._extensionList.setSelection([0]);
			this._extensionList.domFocus();
			this._addNewTabButton.enabled = true;
		} else {
			this._extensionViewContainer.hidden = true;
			this._noExtensionViewContainer.hidden = false;
			this._addNewTabButton.enabled = false;
			this._cancelButton.focus();
		}
	}

	public dispose(): void {
		super.dispose();
	}
}
