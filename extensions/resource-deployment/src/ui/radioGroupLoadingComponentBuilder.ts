/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { OptionsInfo } from '../interfaces';
import { getErrorMessage } from '../utils';

export class RadioGroupLoadingComponentBuilder implements azdata.ComponentBuilder<azdata.LoadingComponent> {
	private _optionsDivContainer!: azdata.DivContainer;
	private _optionsLoadingBuilder: azdata.LoadingComponentBuilder;
	private _onValueChangedEmitter: vscode.EventEmitter<void> = new vscode.EventEmitter();
	private _currentRadioOption!: azdata.RadioButtonComponent;
	constructor(private _view: azdata.ModelView, private _onNewDisposableCreated: (disposable: vscode.Disposable) => void) {
		this._optionsDivContainer = this._view!.modelBuilder.divContainer().withProperties<azdata.DivContainerProperties>({ clickable: false }).component();
		this._optionsLoadingBuilder = this._view!.modelBuilder.loadingComponent().withItem(this._optionsDivContainer);
	}

	component(): azdata.LoadingComponent {
		return this._optionsLoadingBuilder.component();
	}

	withProperties<U>(properties: U): azdata.ComponentBuilder<azdata.LoadingComponent> {
		return this._optionsLoadingBuilder.withProperties(properties);
	}

	withValidation(validation: (component: azdata.LoadingComponent) => boolean): azdata.ComponentBuilder<azdata.LoadingComponent> {
		return this._optionsLoadingBuilder.withValidation(validation);
	}

	async loadOptions(optionsInfo: OptionsInfo | (() => Promise<OptionsInfo>)): Promise<void> {
		this.component().loading = true;
		this._optionsDivContainer.clearItems();
		try {
			if (typeof optionsInfo !== 'object') {
				optionsInfo = await optionsInfo();
			}

			let options: (string[] | azdata.CategoryValue[]) = optionsInfo.values!;
			let defaultValue: string = optionsInfo.defaultValue!;
			options.forEach((op: string | azdata.CategoryValue) => {
				const option: azdata.CategoryValue = (typeof op === 'string')
					? { name: op, displayName: op }
					: op as azdata.CategoryValue;
				const radioOption = this._view!.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({
					label: option.displayName,
					checked: option.displayName === defaultValue,
					name: option.name,
				}).component();
				if (radioOption.checked) {
					this._currentRadioOption = radioOption;
					this._onValueChangedEmitter.fire();
				}
				this._onNewDisposableCreated(radioOption.onDidClick(() => {
					this._optionsDivContainer.items
						.filter(otherOption => otherOption !== radioOption)
						.forEach(otherOption => (otherOption as azdata.RadioButtonComponent).checked = false);
					this._currentRadioOption = radioOption;
					this._onValueChangedEmitter.fire();
				}));
				this._optionsDivContainer.addItem(radioOption);
			});
		}
		catch (e) {
			const errorLoadingRadioOptionsLabel = this._view!.modelBuilder.text().withProperties({ value: getErrorMessage(e), CSSStyles: { 'color': 'Red' } }).component();
			this._optionsDivContainer.addItem(errorLoadingRadioOptionsLabel);
		}
		this.component().loading = false;
	}

	get value(): string | undefined {
		return this._currentRadioOption?.label;
	}

	get checked(): azdata.RadioButtonComponent {
		return this._currentRadioOption;
	}

	get onValueChanged(): vscode.Event<void> {
		return this._onValueChangedEmitter.event;
	}
}
