/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/optionsDialog';
import * as DialogHelper from './dialogHelper';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IModalOptions, Modal } from './modal';
import * as OptionsDialogHelper from './optionsDialogHelper';
import { attachButtonStyler, attachModalDialogStyler, attachPanelStyler } from 'sql/platform/theme/common/styler';
import { ServiceOptionType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ScrollableSplitView } from 'sql/base/browser/ui/scrollableSplitview/scrollableSplitview';

import * as sqlops from 'sqlops';

import { IPartService } from 'vs/workbench/services/part/common/partService';
import { Event, Emitter } from 'vs/base/common/event';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IContextViewService, IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { localize } from 'vs/nls';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IWorkbenchThemeService, IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { contrastBorder } from 'vs/platform/theme/common/colorRegistry';
import * as styler from 'vs/platform/theme/common/styler';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { Builder, $ } from 'sql/base/browser/builder';
import { Widget } from 'vs/base/browser/ui/widget';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IViewletPanelOptions, ViewletPanel } from 'vs/workbench/browser/parts/views/panelViewlet';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class CategoryView extends ViewletPanel {

	constructor(
		private contentElement: HTMLElement,
		private size: number,
		options: IViewletPanelOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(options, keybindingService, contextMenuService, configurationService);
	}

	// we want a fixed size, so when we render to will measure our content and set that to be our
	// minimum and max size
	protected renderBody(container: HTMLElement): void {
		container.appendChild(this.contentElement);
		this.maximumBodySize = this.size;
		this.minimumBodySize = this.size;
	}

	protected layoutBody(size: number): void {
		//
	}
}

export interface IOptionsDialogOptions extends IModalOptions {
	cancelLabel?: string;
}

export class OptionsDialog extends Modal {
	private _body: HTMLElement;
	private _optionGroups: HTMLElement;
	private _dividerBuilder: Builder;
	private _optionTitle: Builder;
	private _optionDescription: Builder;
	private _optionElements: { [optionName: string]: OptionsDialogHelper.IOptionElement } = {};
	private _optionValues: { [optionName: string]: string };
	private _optionRowSize = 31;
	private _optionCategoryPadding = 30;
	private height: number;
	private splitview: ScrollableSplitView;

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;

	private _onCloseEvent = new Emitter<void>();
	public onCloseEvent: Event<void> = this._onCloseEvent.event;

	constructor(
		title: string,
		name: string,
		private options: IOptionsDialogOptions,
		@IPartService partService: IPartService,
		@IWorkbenchThemeService private _workbenchThemeService: IWorkbenchThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService
	) {
		super(title, name, partService, telemetryService, clipboardService, _workbenchThemeService, contextKeyService, options);
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		if (this.backButton) {
			this.backButton.onDidClick(() => this.cancel());
			attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND });
		}
		let okButton = this.addFooterButton(localize('optionsDialog.ok', 'OK'), () => this.ok());
		let closeButton = this.addFooterButton(this.options.cancelLabel || localize('optionsDialog.cancel', 'Cancel'), () => this.cancel());
		// Theme styler
		attachButtonStyler(okButton, this._themeService);
		attachButtonStyler(closeButton, this._themeService);
		this._register(this._workbenchThemeService.onDidColorThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._workbenchThemeService.getColorTheme());
	}

	protected renderBody(container: HTMLElement) {
		new Builder(container).div({ class: 'optionsDialog-options' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
		});

		let builder = new Builder(this._body);
		builder.div({}, (dividerContainer) => {
			this._dividerBuilder = dividerContainer;
		});

		builder.div({ class: 'optionsDialog-description' }, (descriptionContainer) => {
			descriptionContainer.div({ class: 'modal-title' }, (optionTitle) => {
				this._optionTitle = optionTitle;
			});
			descriptionContainer.div({ class: 'optionsDialog-description-content' }, (optionDescription) => {
				this._optionDescription = optionDescription;
			});
		});
	}

	// Update theming that is specific to options dialog flyout body
	private updateTheme(theme: IColorTheme): void {
		let borderColor = theme.getColor(contrastBorder);
		let border = borderColor ? borderColor.toString() : null;
		if (this._dividerBuilder) {
			this._dividerBuilder.style('border-top-width', border ? '1px' : null);
			this._dividerBuilder.style('border-top-style', border ? 'solid' : null);
			this._dividerBuilder.style('border-top-color', border);
		}
	}

	private onOptionLinkClicked(optionName: string): void {
		let option = this._optionElements[optionName].option;
		this._optionTitle.text(option.displayName);
		this._optionDescription.text(option.description);
	}

	private fillInOptions(container: Builder, options: sqlops.ServiceOption[]): void {
		for (let i = 0; i < options.length; i++) {
			let option: sqlops.ServiceOption = options[i];
			let rowContainer = DialogHelper.appendRow(container, option.displayName, 'optionsDialog-label', 'optionsDialog-input');
			OptionsDialogHelper.createOptionElement(option, rowContainer, this._optionValues, this._optionElements, this._contextViewService, (name) => this.onOptionLinkClicked(name));
		}
	}

	private registerStyling(): void {
		// Theme styler
		for (let optionName in this._optionElements) {
			let widget: Widget = this._optionElements[optionName].optionWidget;
			let option = this._optionElements[optionName].option;
			switch (option.valueType) {
				case ServiceOptionType.category:
				case ServiceOptionType.boolean:
					this._register(styler.attachSelectBoxStyler(<SelectBox>widget, this._themeService));
					break;
				case ServiceOptionType.string:
				case ServiceOptionType.password:
				case ServiceOptionType.number:
					this._register(styler.attachInputBoxStyler(<InputBox>widget, this._themeService));
			}
		}
	}

	public get optionValues(): { [name: string]: any } {
		return this._optionValues;
	}

	public hideError() {
		this.setError('');
	}

	public showError(err: string) {
		this.setError(err);
	}

	/* Overwrite escape key behavior */
	protected onClose() {
		this.close();
	}

	/* Overwrite enter key behavior */
	protected onAccept() {
		this.ok();
	}

	public ok(): void {
		if (OptionsDialogHelper.validateInputs(this._optionElements)) {
			OptionsDialogHelper.updateOptions(this._optionValues, this._optionElements);
			this._onOk.fire();
			this.close();
		}
	}

	public cancel() {
		this.close();
	}

	public close() {
		this._optionGroups.remove();
		this.dispose();
		this.hide();
		this._onCloseEvent.fire();
	}

	public open(options: sqlops.ServiceOption[], optionValues: { [name: string]: any }) {
		this._optionValues = optionValues;
		let firstOption: string;
		let containerGroup: Builder;
		let optionsContentBuilder: Builder = $().div({ class: 'optionsDialog-options-groups monaco-panel-view' }, (container) => {
			containerGroup = container;
			this._optionGroups = container.getHTMLElement();
		});
		this.splitview = new ScrollableSplitView(containerGroup.getHTMLElement(), { enableResizing: false, scrollDebounce: 0 });
		let categoryMap = OptionsDialogHelper.groupOptionsByCategory(options);
		for (let category in categoryMap) {
			let serviceOptions: sqlops.ServiceOption[] = categoryMap[category];
			let bodyContainer = $().element('table', { class: 'optionsDialog-table' }, (tableContainer: Builder) => {
				this.fillInOptions(tableContainer, serviceOptions);
			});

			let viewSize = this._optionCategoryPadding + serviceOptions.length * this._optionRowSize;
			let categoryView = this._instantiationService.createInstance(CategoryView, bodyContainer.getHTMLElement(), viewSize, { title: category, ariaHeaderLabel: category, id: category });
			this.splitview.addView(categoryView, viewSize);
			categoryView.render();
			attachPanelStyler(categoryView, this._themeService);

			if (!firstOption) {
				firstOption = serviceOptions[0].name;
			}
		}
		if (this.height) {
			this.splitview.layout(this.height - 120);
		}
		let body = new Builder(this._body);
		body.append(optionsContentBuilder.getHTMLElement(), 0);
		this.show();
		let firstOptionWidget = this._optionElements[firstOption].optionWidget;
		this.registerStyling();
		firstOptionWidget.focus();
	}

	protected layout(height?: number): void {
		this.height = height;
		// account for padding and the details view
		this.splitview.layout(this.height - 120 - 20);
	}

	public dispose(): void {
		super.dispose();
		for (let optionName in this._optionElements) {
			let widget: Widget = this._optionElements[optionName].optionWidget;
			widget.dispose();
			delete this._optionElements[optionName];
		}
	}
}