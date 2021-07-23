/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';

export interface RadioOptionsInfo {
	values?: string[],
	defaultValue: string
}

export class RadioOptionsGroup {
	static id: number = 1;
	private _divContainer!: azdata.DivContainer;
	private _loadingBuilder: azdata.LoadingComponentBuilder;
	private _currentRadioOption!: azdata.RadioButtonComponent;

	private _onRadioOptionChanged: vscode.EventEmitter<string | undefined> = new vscode.EventEmitter<string | undefined>();
	public onRadioOptionChanged: vscode.Event<string | undefined> = this._onRadioOptionChanged.event;

	constructor(private _modelBuilder: azdata.ModelBuilder,
		private _onNewDisposableCreated: (disposable: vscode.Disposable) => void,
		private _groupName: string = `RadioOptionsGroup${RadioOptionsGroup.id++}`,
		private _loadingCompleteMessage: string,
		private _loadingCompleteErrorMessage: (error: any) => string
	) {
		this._divContainer = this._modelBuilder.divContainer().withProps({ clickable: false }).component();
		this._loadingBuilder = this._modelBuilder.loadingComponent().withItem(this._divContainer);
	}

	public component(): azdata.LoadingComponent {
		return this._loadingBuilder.component();
	}

	async load(optionsInfoGetter: () => RadioOptionsInfo | Promise<RadioOptionsInfo>): Promise<void> {
		this.component().loading = true;
		this._divContainer.clearItems();
		try {
			const optionsInfo = await optionsInfoGetter();
			const options = optionsInfo.values!;
			let defaultValue: string = optionsInfo.defaultValue!;
			options.forEach((option: string) => {
				const radioOption = this._modelBuilder.radioButton().withProps({
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
					if (this._currentRadioOption !== radioOption) {
						// uncheck the previously saved radio option, the ui gets handled correctly even if we did not do this due to the use of the 'groupName',
						// however, the checked properties on the radio button do not get updated, so while the stuff works even if we left the previous option checked,
						// it is just better to keep things clean.
						this._currentRadioOption.checked = false;
						this._currentRadioOption = radioOption;
						this._onRadioOptionChanged.fire(this.value);
					}
				}));
				this._divContainer.addItem(radioOption);
			});
			this.component().loadingCompletedText = this._loadingCompleteMessage;
		}
		catch (e) {
			const errorLabel = this._modelBuilder.text().withProps({ value: loc.loadingClusterContextsError(e), CSSStyles: { 'color': 'Red' } }).component();
			this._divContainer.addItem(errorLabel);
			this.component().loadingCompletedText = this._loadingCompleteErrorMessage(e);
		}
		this.component().loading = false;
	}

	get value(): string | undefined {
		return this._currentRadioOption?.value;
	}

	get items(): azdata.Component[] {
		return this._divContainer.items;
	}
}
