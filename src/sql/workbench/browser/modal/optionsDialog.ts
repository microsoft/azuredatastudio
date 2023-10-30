/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/optionsDialog';
import * as DialogHelper from './dialogHelper';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { HideReason, IModalOptions, Modal } from './modal';
import * as OptionsDialogHelper from './optionsDialogHelper';

import * as azdata from 'azdata';

import { Event, Emitter } from 'vs/base/common/event';
//import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { contrastBorder } from 'vs/platform/theme/common/colorRegistry';
//import * as styler from 'sql/platform/theme/common/vsstyler';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { Widget } from 'vs/base/browser/ui/widget';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { append, $, clearNode, createCSSRule } from 'vs/base/browser/dom';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { GroupHeaderBackground } from 'sql/platform/theme/common/colorRegistry';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { AdsWidget } from 'sql/base/browser/ui/adsWidget';
import { Actions } from 'sql/platform/connection/common/constants';
import { RequiredIndicatorClassName } from 'sql/base/browser/ui/label/label';

export interface IOptionsDialogOptions extends IModalOptions {
	cancelLabel?: string;
}

export class OptionsDialog extends Modal {
	private _body?: HTMLElement;
	private _optionGroupsContainer?: HTMLElement;
	private _categoryTitles: HTMLElement[] = [];
	private _dividerBuilder?: HTMLElement;
	private _optionTitle?: HTMLElement;
	private _optionDescription?: HTMLElement;
	private _optionElements: { [optionName: string]: OptionsDialogHelper.IOptionElement } = {};
	private _optionValues: { [optionName: string]: string } = {};

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;

	private _onCloseEvent = new Emitter<void>();
	public onCloseEvent: Event<void> = this._onCloseEvent.event;

	constructor(
		title: string,
		name: string,
		options: IOptionsDialogOptions | undefined,
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

	public override render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		if (this.backButton) {
			this.backButton.onDidClick(() => this.cancel());
		}
		this.addFooterButton(localize('optionsDialog.ok', "OK"), () => this.ok());
		this.addFooterButton(this.options.cancelLabel || localize('optionsDialog.cancel', "Cancel"), () => this.cancel(), 'right', true);
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
		const border = borderColor ? borderColor.toString() : '';
		const backgroundColor = theme.getColor(GroupHeaderBackground);
		if (this._dividerBuilder) {
			this._dividerBuilder.style.borderTopWidth = border ? '1px' : '';
			this._dividerBuilder.style.borderTopStyle = border ? 'solid' : '';
			this._dividerBuilder.style.borderTopColor = border;
		}
		this._categoryTitles.forEach(titleElement => {
			titleElement.style.borderWidth = border ? '1px 0px' : '';
			titleElement.style.borderStyle = border ? 'solid none' : '';
			titleElement.style.borderColor = border;
			titleElement.style.backgroundColor = backgroundColor ? backgroundColor.toString() : '';
		});
	}

	private onOptionLinkClicked(optionName: string): void {
		let option = this._optionElements[optionName].option;
		this._optionTitle!.innerText = option.displayName;
		this._optionDescription!.innerText = option.description;
	}

	private fillInOptions(container: HTMLElement, options: azdata.ServiceOption[]): void {
		for (let i = 0; i < options.length; i++) {
			let option: azdata.ServiceOption = options[i];
			let rowContainer = DialogHelper.appendRow(container, option.displayName, 'optionsDialog-label', 'optionsDialog-input', `option-${option.name}`, option.isRequired);
			const optionElement = OptionsDialogHelper.createOptionElement(option, rowContainer, this._optionValues, this._optionElements, this._contextViewService, (name) => this.onOptionLinkClicked(name));
			this._register(optionElement.optionWidget);
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
	protected override onClose() {
		this.close();
	}

	/* Overwrite enter key behavior */
	protected override onAccept() {
		this.ok();
	}

	public ok(): void {
		if (OptionsDialogHelper.validateInputs(this._optionElements)) {
			OptionsDialogHelper.updateOptions(this._optionValues, this._optionElements);
			this._onOk.fire();
			this.close('ok');
		}
	}

	public cancel() {
		this.close('cancel');
	}

	public close(hideReason: HideReason = 'close') {
		this.hide(hideReason);
		this._optionElements = {};
		this._onCloseEvent.fire();
	}

	public open(options: azdata.ServiceOption[], optionValues: { [name: string]: any }) {
		this._optionValues = optionValues;
		let categoryMap = OptionsDialogHelper.groupOptionsByCategory(options);
		clearNode(this._optionGroupsContainer!);
		for (let category in categoryMap) {
			const title = append(this._optionGroupsContainer!, $('h2.option-category-title'));
			title.innerText = category;
			this._categoryTitles.push(title);

			let serviceOptions: azdata.ServiceOption[] = categoryMap[category];
			let bodyContainer = $('table.optionsDialog-table');
			bodyContainer.setAttribute('role', 'presentation');
			this.fillInOptions(bodyContainer, serviceOptions);
			this.registerOnSelectionChangeEvents(optionValues, bodyContainer);
			append(this._optionGroupsContainer!, bodyContainer);
		}
		this.updateTheme(this._themeService.getColorTheme());
		this.show();
	}

	/**
	 * Registers on selection change event for connection options configured with 'onSelectionChange' property.
	 */
	private registerOnSelectionChangeEvents(optionValues: { [name: string]: any }, container: HTMLElement): void {
		//Register on selection change event for all advanced options
		for (let optionName in this._optionElements) {
			let widget: Widget = this._optionElements[optionName].optionWidget;
			if (widget instanceof SelectBox) {
				this._registerSelectionChangeEvents([this._optionElements], this._optionElements[optionName].option, widget, container);
			}
		}
	}

	private _registerSelectionChangeEvents(collections: { [optionName: string]: OptionsDialogHelper.IOptionElement }[], option: azdata.ServiceOption, widget: SelectBox, container: HTMLElement) {
		if (option?.onSelectionChange) {
			option.onSelectionChange.forEach((event) => {
				this._register(widget.onDidSelect(value => {
					let selectedValue = value.selected;
					event?.dependentOptionActions?.forEach((optionAction) => {
						let defaultValue: string | undefined = collections[optionAction.optionName]?.option.defaultValue ?? '';
						let widget: AdsWidget | undefined = this._findWidget(collections, optionAction.optionName);
						if (widget) {
							createCSSRule(`.hide-${widget.id} .option-${widget.id}`, `display: none;`);
							this._onValueChangeEvent(container, selectedValue, event.values, widget, defaultValue, optionAction);
						}
					});
				}));
				event?.dependentOptionActions?.forEach((optionAction) => {
					if (this._optionValues[optionAction.optionName] && optionAction.required) {
						let element = DialogHelper.getOptionContainerByName(container, optionAction.optionName) as HTMLElement;
						// Append required indicator when not present.
						if (element && element.childElementCount === 1) {
							element.classList.add(RequiredIndicatorClassName);
						}
					}
					// Force selection event if option value is available.
					if (this.optionValues[option.name]) {
						widget.selectWithOptionName(this.optionValues[option.name], false, true);
					}
				});
			});
			// Clear selection change actions once event is registered.
			option.onSelectionChange = undefined;
			if (this.optionValues[option.name]) {
				widget.selectWithOptionName(this.optionValues[option.name], true);
			} else {
				widget.select(0, true);
			}
		}
	}

	private _onValueChangeEvent(container: HTMLElement, selectedValue: string, acceptedValues: string[],
		widget: AdsWidget, defaultValue: string, optionAction: azdata.DependentOptionAction): void {
		if ((acceptedValues.includes(selectedValue.toLocaleLowerCase()) && optionAction.action === Actions.Show)
			|| (!acceptedValues.includes(selectedValue.toLocaleLowerCase()) && optionAction.action === Actions.Hide)) {
			container.classList.remove(`hide-${widget.id}`);
			if (optionAction.required) {
				let element = DialogHelper.getOptionContainerByName(container, optionAction.optionName) as HTMLElement;
				// Append required indicator when not present.
				if (element && element.childElementCount === 1) {
					element.classList.add(RequiredIndicatorClassName);
				}
			}
		} else {
			// Support more Widget classes here as needed.
			if (widget instanceof SelectBox) {
				widget.select(widget.values.indexOf(defaultValue));
			} else if (widget instanceof InputBox) {
				widget.value = defaultValue;
			}

			// Reset required indicator if present.
			let element = DialogHelper.getOptionContainerByName(container, optionAction.optionName);
			if (element && element!.hasChildNodes && element.childElementCount > 1) {
				element!.children.item(1).remove();
			}

			container.classList.add(`hide-${widget.id}`);
			widget.hideMessage();
		}
	}

	/**
	 * Finds Widget from provided collection of widgets using option name.
	 * @param collections collections of widgets to search for the widget with the widget Id
	 * @param id Widget Id
	 * @returns Widget if found, undefined otherwise
	 */
	private _findWidget(collections: { [optionName: string]: OptionsDialogHelper.IOptionElement }[], id: string): AdsWidget | undefined {
		return collections.find(collection => !!collection[id].optionWidget)[id]?.optionWidget;
	}

	protected layout(height?: number): void {
	}

	public override dispose(): void {
		super.dispose();
		this._optionElements = {};
	}
}
