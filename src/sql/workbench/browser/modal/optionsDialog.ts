/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/optionsDialog';
import * as DialogHelper from './dialogHelper';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IModalOptions, Modal } from './modal';
import * as OptionsDialogHelper from './optionsDialogHelper';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';

import * as azdata from 'azdata';

import { Event, Emitter } from 'vs/base/common/event';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { contrastBorder } from 'vs/platform/theme/common/colorRegistry';
import * as styler from 'vs/platform/theme/common/styler';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { Widget } from 'vs/base/browser/ui/widget';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { append, $, clearNode } from 'vs/base/browser/dom';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ServiceOptionType } from 'sql/platform/connection/common/interfaces';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

export interface IOptionsDialogOptions extends IModalOptions {
	cancelLabel?: string;
}

export class OptionsDialog extends Modal {
	private _body: HTMLElement;
	private _optionGroupsContainer: HTMLElement;
	private _categoryTitles: HTMLElement[] = [];
	private _dividerBuilder: HTMLElement;
	private _optionTitle: HTMLElement;
	private _optionDescription: HTMLElement;
	private _optionElements: { [optionName: string]: OptionsDialogHelper.IOptionElement } = {};
	private _optionValues: { [optionName: string]: string };

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;

	private _onCloseEvent = new Emitter<void>();
	public onCloseEvent: Event<void> = this._onCloseEvent.event;

	constructor(
		title: string,
		name: string,
		options: IOptionsDialogOptions,
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(title, name, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, options);
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		if (this.backButton) {
			this.backButton.onDidClick(() => this.cancel());
			attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND });
		}
		let okButton = this.addFooterButton(localize('optionsDialog.ok', "OK"), () => this.ok());
		let closeButton = this.addFooterButton(this.options.cancelLabel || localize('optionsDialog.cancel', "Cancel"), () => this.cancel());
		// Theme styler
		attachButtonStyler(okButton, this._themeService);
		attachButtonStyler(closeButton, this._themeService);
		this._register(this._themeService.onDidColorThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._themeService.getColorTheme());
	}

	protected renderBody(container: HTMLElement) {
		this._body = append(container, $('div.optionsDialog-options'));

		this._dividerBuilder = append(this._body, $('div'));

		this._optionGroupsContainer = append(this._body, $('div.optionsDialog-options-groups.monaco-pane-view'));

		const descriptionContainer = append(this._body, $('div.optionsDialog-description'));

		this._optionTitle = append(descriptionContainer, $('div.modal-title'));
		this._optionDescription = append(descriptionContainer, $('div.optionsDialog-description-content'));
	}

	// Update theming that is specific to options dialog flyout body
	private updateTheme(theme: IColorTheme): void {
		const borderColor = theme.getColor(contrastBorder);
		const border = borderColor ? borderColor.toString() : null;
		const backgroundColor = theme.getColor(SIDE_BAR_BACKGROUND);
		if (this._dividerBuilder) {
			this._dividerBuilder.style.borderTopWidth = border ? '1px' : null;
			this._dividerBuilder.style.borderTopStyle = border ? 'solid' : null;
			this._dividerBuilder.style.borderTopColor = border;
		}
		this._categoryTitles.forEach(titleElement => {
			titleElement.style.borderWidth = border ? '1px 0px' : null;
			titleElement.style.borderStyle = border ? 'solid none' : null;
			titleElement.style.borderColor = border;
			titleElement.style.backgroundColor = backgroundColor ? backgroundColor.toString() : null;
		});
	}

	private onOptionLinkClicked(optionName: string): void {
		let option = this._optionElements[optionName].option;
		this._optionTitle.innerText = option.displayName;
		this._optionDescription.innerText = option.description;
	}

	private fillInOptions(container: HTMLElement, options: azdata.ServiceOption[]): void {
		for (let i = 0; i < options.length; i++) {
			let option: azdata.ServiceOption = options[i];
			let rowContainer = DialogHelper.appendRow(container, option.displayName, 'optionsDialog-label', 'optionsDialog-input');
			const optionElement = OptionsDialogHelper.createOptionElement(option, rowContainer, this._optionValues, this._optionElements, this._contextViewService, (name) => this.onOptionLinkClicked(name));
			this.disposableStore.add(optionElement.optionWidget);
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
					this.disposableStore.add(styler.attachSelectBoxStyler(<SelectBox>widget, this._themeService));
					break;
				case ServiceOptionType.string:
				case ServiceOptionType.password:
				case ServiceOptionType.number:
					this.disposableStore.add(styler.attachInputBoxStyler(<InputBox>widget, this._themeService));
			}
		}
	}

	private get options(): IOptionsDialogOptions {
		return this._modalOptions as IOptionsDialogOptions;
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
		this.hide();
		this._optionElements = {};
		this._onCloseEvent.fire();
	}

	public open(options: azdata.ServiceOption[], optionValues: { [name: string]: any }) {
		this._optionValues = optionValues;
		let firstOption: string;
		let categoryMap = OptionsDialogHelper.groupOptionsByCategory(options);
		clearNode(this._optionGroupsContainer);
		for (let category in categoryMap) {
			const title = append(this._optionGroupsContainer, $('h2.option-category-title'));
			title.innerText = category;
			this._categoryTitles.push(title);

			let serviceOptions: azdata.ServiceOption[] = categoryMap[category];
			let bodyContainer = $('table.optionsDialog-table');
			this.fillInOptions(bodyContainer, serviceOptions);
			append(this._optionGroupsContainer, bodyContainer);

			if (!firstOption) {
				firstOption = serviceOptions[0].name;
			}
		}
		this.updateTheme(this._themeService.getColorTheme());
		this.show();
		let firstOptionWidget = this._optionElements[firstOption].optionWidget;
		this.registerStyling();
		setTimeout(() => firstOptionWidget.focus(), 1);
	}

	protected layout(height?: number): void {
	}

	public dispose(): void {
		super.dispose();
		this._optionElements = {};
	}
}
