/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getErrorMessage } from '../../common/utils';
import { IReadOnly } from '../dialogs/connectControllerDialog';

export interface RadioOptionsInfo {
	values?: string[],
	defaultValue: string
}

export class RadioOptionsGroup implements IReadOnly {
	static id: number = 1;
	private _divContainer!: azdata.DivContainer;
	private _loadingBuilder: azdata.LoadingComponentBuilder;
	private _currentRadioOption!: azdata.RadioButtonComponent;

	constructor(private _modelBuilder: azdata.ModelBuilder, private _onNewDisposableCreated: (disposable: vscode.Disposable) => void, private _groupName: string = `RadioOptionsGroup${RadioOptionsGroup.id++}`) {
		this._divContainer = this._modelBuilder.divContainer().withProperties<azdata.DivContainerProperties>({ clickable: false }).component();
		this._loadingBuilder = this._modelBuilder.loadingComponent().withItem(this._divContainer);
	}

	public component(): azdata.LoadingComponent {
		return this._loadingBuilder.component();
	}

	async load(optionsInfoGetter: () => Promise<RadioOptionsInfo>): Promise<void> {
		this.component().loading = true;
		this._divContainer.clearItems();
		try {
			const optionsInfo = await optionsInfoGetter();
			const options = optionsInfo.values!;
			let defaultValue: string = optionsInfo.defaultValue!;
			options.forEach((option: string) => {
				const radioOption = this._modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({
					label: option,
					checked: option === defaultValue,
					name: this._groupName,
					value: option,
					enabled: true
				}).component();
				if (radioOption.checked) {
					this._currentRadioOption = radioOption;
				}
				this._onNewDisposableCreated(radioOption.onDidClick(() => {
					// this._divContainer.items
					// 	.filter(otherOption => otherOption !== radioOption)
					// 	.forEach(otherOption => (otherOption as azdata.RadioButtonComponent).checked = false);
					console.log(`TCL:: new current radio option:`, JSON.stringify(radioOption, undefined, '\t'));
					console.log(`TCL:: ~ file: radioOptionsGroup.ts ~ line 90 ~ RadioOptionsGroup ~ this._onNewDisposableCreated ~ radioOption`, radioOption);
					this._currentRadioOption = radioOption;
				}));
				this._divContainer.addItem(radioOption);
			});
		}
		catch (e) {
			const errorLabel = this._modelBuilder.text().withProperties({ value: getErrorMessage(e), CSSStyles: { 'color': 'Red' } }).component();
			this._divContainer.addItem(errorLabel);
		}
		this.component().loading = false;
	}

	get value(): string | undefined {
		return this._currentRadioOption?.value;
	}

	get checked(): azdata.RadioButtonComponent {
		return this._currentRadioOption;
	}

	get readOnly(): boolean | undefined {
		return this.enabled;
	}

	set readOnly(value: boolean | undefined) {
		this.enabled = value;
	}

	get enabled(): boolean | undefined {
		return this._divContainer.items.every(r => r.enabled) && this._divContainer.enabled;
	}

	set enabled(value: boolean | undefined) {
		this._divContainer.items.forEach(r => r.enabled = value);
		this._divContainer.enabled = value;
	}
}
