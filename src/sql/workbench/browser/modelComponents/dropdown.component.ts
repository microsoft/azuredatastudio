/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/dropdown';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy, AfterViewInit
} from '@angular/core';

import * as azdata from 'azdata';

import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { Dropdown, IDropdownOptions } from 'sql/base/parts/editableDropdown/browser/dropdown';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { attachEditableDropdownStyler } from 'sql/platform/theme/common/styler';
import { attachSelectBoxStyler } from 'vs/platform/theme/common/styler';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IComponent, IComponentDescriptor, IModelStore, ComponentEventType } from 'sql/platform/dashboard/browser/interfaces';
import { localize } from 'vs/nls';
import { onUnexpectedError } from 'vs/base/common/errors';
import { ILogService } from 'vs/platform/log/common/log';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { errorForeground } from 'vs/platform/theme/common/colorRegistry';

@Component({
	selector: 'modelview-dropdown',
	template: `

	<div [ngStyle]="CSSStyles">
		<div *ngIf="loading" style="width: 100%; position: relative">
			<div class="modelview-loadingComponent-spinner" style="position:absolute; right: 0px; margin-right: 5px; height:15px; z-index:1" #spinnerElement></div>
			<div #loadingBox style="width: 100%;"></div>
		</div>
		<div [style.display]="getEditableDisplay()" #editableDropDown style="width: 100%;"></div>
		<div [style.display]="getNotEditableDisplay()" #dropDown style="width: 100%;"></div>
		<label #errorMessage tabindex="-1"
		aria-live="polite" [attr.id]="errorId" aria-atomic="true"
		*ngIf="!_valid && validationErrorMessages && validationErrorMessages.length!==0 && !isInitState">
			<ng-container *ngFor="let error of validationErrorMessages">
				<div  class="dropdown-error-container">
					<div class="sql codicon error dropdown-error-icon"></div>
					<span class="dropdown-error-text">{{error}}</span>
				</div>
			</ng-container>
		</label>
	</div>
	`
})
export default class DropDownComponent extends ComponentBase<azdata.DropDownProperties> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	private _editableDropdown: Dropdown;
	private _selectBox: SelectBox;
	private _isInAccessibilityMode: boolean;
	private _loadingBox: SelectBox;
	/**
	 * This flag is used to hide the error message in the initial state of the dropdown. We do not want to show the error message before user has interacted with it.
	 */
	public isInitState: boolean = true;

	@ViewChild('editableDropDown', { read: ElementRef }) private _editableDropDownContainer: ElementRef;
	@ViewChild('dropDown', { read: ElementRef }) private _dropDownContainer: ElementRef;
	@ViewChild('loadingBox', { read: ElementRef }) private _loadingBoxContainer: ElementRef;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IConfigurationService) private readonly configurationService: IConfigurationService,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);

		if (this.configurationService) {
			this._isInAccessibilityMode = this.configurationService.getValue('editor.accessibilitySupport') === 'on';
		}
	}

	ngAfterViewInit(): void {
		if (this._editableDropDownContainer) {
			let dropdownOptions: IDropdownOptions = {
				values: [],
				strictSelection: false,
				placeholder: this.placeholder,
				maxHeight: 125,
				ariaLabel: ''
			};
			this._editableDropdown = new Dropdown(this._editableDropDownContainer.nativeElement, this.contextViewService,
				dropdownOptions);

			this._register(this._editableDropdown);
			this._register(attachEditableDropdownStyler(this._editableDropdown, this.themeService));
			this._register(this._editableDropdown.onValueChange(async e => {
				if (this.editable) {
					this.setSelectedValue(e);
					await this.validate();
					this.fireEvent({
						eventType: ComponentEventType.onDidChange,
						args: e
					});
				}
				this.isInitState = false;
			}));
			this._validations.push(() => !this.required || !this.editable || !!this._editableDropdown.value);
		}
		if (this._dropDownContainer) {
			this._selectBox = new SelectBox(this.getValues(), this.getSelectedValue(), this.contextViewService, this._dropDownContainer.nativeElement);
			this._selectBox.render(this._dropDownContainer.nativeElement);
			this._register(this._selectBox);
			this._register(attachSelectBoxStyler(this._selectBox, this.themeService));
			this._register(this._selectBox.onDidSelect(async e => {
				// also update the selected value here while in accessibility mode since the read-only selectbox
				// is used even if the editable flag is true
				if (!this.editable || (this._isInAccessibilityMode && !this.loading)) {
					this.setSelectedValue(e.selected);
					await this.validate();
				}
				if (!this.editable) {
					// This is currently sending the ISelectData as the args, but to change this now would be a breaking
					// change for extensions using it. So while not ideal this should be left as is for the time being.
					this.fireEvent({
						eventType: ComponentEventType.onDidChange,
						args: e
					});
				}
				this.isInitState = false;
			}));
			this._validations.push(() => !this.required || this.editable || !!this._selectBox.value);
		}
		this._validations.push(() => !this.loading);
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	public override async validate(): Promise<boolean> {
		const validationResult = await super.validate();
		this._changeRef.detectChanges();
		if (!validationResult) {
			if (this.editable) {
				this._editableDropdown.inputElement.setAttribute('aria-describedby', this.errorId);
				this._editableDropdown.inputElement.setAttribute('aria-errormessage', this.errorId);
				this._editableDropdown.inputElement.setAttribute('aria-invalid', 'true');
			} else {
				this._selectBox.selectElem.setAttribute('aria-describedby', this.errorId);
				this._selectBox.selectElem.setAttribute('aria-errormessage', this.errorId);
				this._selectBox.selectElem.setAttribute('aria-invalid', 'true');
			}
		} else {
			if (this.editable) {
				this._editableDropdown.inputElement.removeAttribute('aria-describedby');
				this._editableDropdown.inputElement.removeAttribute('aria-errormessage');
				this._editableDropdown.inputElement.removeAttribute('aria-invalid');
			} else {
				this._selectBox.selectElem.removeAttribute('aria-describedby');
				this._selectBox.selectElem.removeAttribute('aria-errormessage');
				this._selectBox.selectElem.removeAttribute('aria-invalid');
			}
		}
		return validationResult;
	}

	/// IComponent implementation

	public setLayout(layout: any): void {
		// TODO allow configuring the look and feel
		this.layout();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);

		if (this.ariaLabel !== '') {
			this._selectBox?.setAriaLabel(this.ariaLabel);
			if (this._editableDropdown) {
				this._editableDropdown.ariaLabel = this.ariaLabel;
			}
		}

		if (this.editable && !this._isInAccessibilityMode) {
			this._editableDropdown.values = this.getValues();
			if (this.value) {
				this._editableDropdown.value = this.getSelectedValue();
			}
			this._editableDropdown.enabled = this.enabled;
			this._editableDropdown.fireOnTextChange = this.fireOnTextChange;

			this._editableDropdown.input.setPlaceHolder(this.placeholder);

			// Add tooltip when editable dropdown is disabled to show overflow text
			this._editableDropdown.input.setTooltip(!this.enabled ? this._editableDropdown.input.value : '');
		} else {
			this._selectBox.setOptions(this.getValues());
			this._selectBox.selectWithOptionName(this.getSelectedValue());
			if (this.enabled) {
				this._selectBox.enable();
			} else {
				this._selectBox.disable();
			}
		}

		if (this.loading) {
			// Lazily create the select box for the loading portion since many dropdowns won't use it
			if (!this._loadingBox) {
				this._loadingBox = new SelectBox([this.getStatusText()], this.getStatusText(), this.contextViewService, this._loadingBoxContainer.nativeElement);
				this._loadingBox.render(this._loadingBoxContainer.nativeElement);
				this._register(this._loadingBox);
				this._register(attachSelectBoxStyler(this._loadingBox, this.themeService));
				this._loadingBoxContainer.nativeElement.className = ''; // Removing the dropdown arrow icon from the right
			}
			if (this.ariaLabel !== '') {
				this._loadingBox.setAriaLabel(this.ariaLabel);
			}
			this._loadingBox.setOptions([this.getStatusText()]);
			this._loadingBox.selectWithOptionName(this.getStatusText());
			this._loadingBox.enable();
		}

		this._selectBox.selectElem.required = this.required;
		this._editableDropdown.inputElement.required = this.required;
		this.validate().catch(onUnexpectedError);
	}

	private getValues(): string[] {
		if (this.values && this.values.length > 0) {
			if (!this.valuesHaveDisplayName()) {
				return this.values as string[];
			} else {
				return (<azdata.CategoryValue[]>this.values).map(v => v.displayName);
			}
		}
		return [];
	}

	private valuesHaveDisplayName(): boolean {
		return typeof (this.values[0]) !== 'string';
	}

	private getSelectedValue(): string {
		if (this.values && this.values.length > 0 && this.valuesHaveDisplayName()) {
			let selectedValue = <azdata.CategoryValue>this.value || <azdata.CategoryValue>this.values[0];
			let valueCategory = (<azdata.CategoryValue[]>this.values).find(v => v.name === selectedValue.name);
			return valueCategory && valueCategory.displayName;
		} else {
			if (!this.value && this.values && this.values.length > 0) {
				return <string>this.values[0];
			}
			return <string>this.value;
		}
	}

	private setSelectedValue(newValue: string): void {
		if (this.values && this.valuesHaveDisplayName()) {
			let valueCategory = (<azdata.CategoryValue[]>this.values).find(v => v.displayName === newValue);
			this.value = valueCategory;
		} else {
			this.value = newValue;
		}
	}

	// CSS-bound properties

	private get value(): string | azdata.CategoryValue {
		return this.getPropertyOrDefault<string | azdata.CategoryValue>((props) => props.value, '');
	}

	private get editable(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.editable, false);
	}

	private get fireOnTextChange(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.fireOnTextChange, false);
	}

	public getEditableDisplay(): string {
		return (this.editable && !this._isInAccessibilityMode) && !this.loading ? '' : 'none';
	}

	public getNotEditableDisplay(): string {
		return (!this.editable || this._isInAccessibilityMode) && !this.loading ? '' : 'none';
	}

	private set value(newValue: string | azdata.CategoryValue) {
		this.setPropertyFromUI<string | azdata.CategoryValue>(this.setValueProperties, newValue);
	}

	private get values(): string[] | azdata.CategoryValue[] {
		return this.getPropertyOrDefault<string[] | azdata.CategoryValue[]>((props) => props.values, []);
	}

	private set values(newValue: string[] | azdata.CategoryValue[]) {
		this.setPropertyFromUI<string[] | azdata.CategoryValue[]>(this.setValuesProperties, newValue);
	}

	private setValueProperties(properties: azdata.DropDownProperties, value: string | azdata.CategoryValue): void {
		properties.value = value;
	}

	private setValuesProperties(properties: azdata.DropDownProperties, values: string[] | azdata.CategoryValue[]): void {
		properties.values = values;
	}

	public get required(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.required, false);
	}

	public set required(newValue: boolean) {
		this.setPropertyFromUI<boolean>((props, value) => props.required = value, newValue);
	}

	public override focus(): void {
		if (this.editable && !this._isInAccessibilityMode) {
			this._editableDropdown.focus();
		} else {
			this._selectBox.focus();
		}
	}

	public get showText(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.showText, false);
	}

	public get loading(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.loading, false);
	}

	public get loadingText(): string {
		return this.getPropertyOrDefault<string>((props) => props.loadingText, localize('loadingMessage', "Loading"));
	}

	public get loadingCompletedText(): string {
		return this.getPropertyOrDefault<string>((props) => props.loadingCompletedText, localize('loadingCompletedMessage', "Loading completed"));
	}

	public getStatusText(): string {
		return this.loading ? this.loadingText : this.loadingCompletedText;
	}

	public override get CSSStyles(): azdata.CssStyles {
		return this.mergeCss(super.CSSStyles, {
			'width': this.getWidth()
		});
	}

	public get placeholder(): string | undefined {
		return this.getPropertyOrDefault<string>((props) => props.placeholder, undefined);
	}

	public get validationErrorMessages(): string[] | undefined {
		let validationErrorMessage = this.getPropertyOrDefault<string[]>((props) => props.validationErrorMessages, undefined);
		if (this.required && this.editable && (!this._editableDropdown.input.value || this._editableDropdown.input.value === '')) {
			return [localize('defaultDropdownErrorMessage', "Please fill out this field.")]; // Adding a default error message for required editable dropdowns having an empty value.
		}
		return validationErrorMessage;
	}

	public get errorId(): string {
		return this.descriptor.id + '-err';
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const errorForegroundColor = theme.getColor(errorForeground);
	if (errorForegroundColor) {
		collector.addRule(`
		.dropdown-error-text {
			color: ${errorForegroundColor};
		}
		`);
	}
});
