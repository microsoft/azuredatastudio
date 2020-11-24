/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { getErrorMessage } from '../../common/utils';

export interface RadioOptionsInfo {
	values?: string[],
	defaultValue: string
}

export class RadioOptionsGroup {
	private _divContainer!: azdata.DivContainer;
	private _loadingBuilder: azdata.LoadingComponentBuilder;
	private _currentRadioOption!: azdata.RadioButtonComponent;
	constructor(private _view: azdata.ModelView, private _onNewDisposableCreated: (disposable: vscode.Disposable) => void) {
		const divBuilder = this._view.modelBuilder.divContainer();
		const divBuilderWithProperties = divBuilder.withProperties<azdata.DivContainerProperties>({ clickable: false });
		this._divContainer = divBuilderWithProperties.component();
		const loadingComponentBuilder = this._view.modelBuilder.loadingComponent();
		this._loadingBuilder = loadingComponentBuilder.withItem(this._divContainer);
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
				const radioOption = this._view!.modelBuilder.radioButton().withProperties<azdata.RadioButtonProperties>({
					label: option,
					checked: option === defaultValue,
					value: option,
					enabled: true
				}).component();
				if (radioOption.checked) {
					this._currentRadioOption = radioOption;
				}
				this._onNewDisposableCreated(radioOption.onDidClick(() => {
					this._divContainer.items
						.filter(otherOption => otherOption !== radioOption)
						.forEach(otherOption => (otherOption as azdata.RadioButtonComponent).checked = false);
					this._currentRadioOption = radioOption;
				}));
				this._divContainer.addItem(radioOption);
			});
		}
		catch (e) {
			const errorLabel = this._view!.modelBuilder.text().withProperties({ value: getErrorMessage(e), CSSStyles: { 'color': 'Red' } }).component();
			this._divContainer.addItem(errorLabel);
		}
		this.component().loading = false;
	}

	get value(): string | undefined {
		return this._currentRadioOption?.label;
	}

	get checked(): azdata.RadioButtonComponent {
		return this._currentRadioOption;
	}
}
