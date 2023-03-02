/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OptionsDialog } from 'sql/workbench/browser/modal/optionsDialog';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

export class AdvancedPropertiesController {
	private _advancedDialog: OptionsDialog;
	private _options: { [name: string]: any };

	constructor(private _onCloseAdvancedProperties: () => void,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
	}


	private handleOnOk(): void {
		this._options = this._advancedDialog.optionValues;
	}

	public showDialog(providerOptions: azdata.ConnectionOption[], options: { [name: string]: any }): void {
		this._options = options;
		let serviceOptions = providerOptions.map(option => AdvancedPropertiesController.connectionOptionToServiceOption(option));
		this.advancedDialog.open(serviceOptions, this._options);
	}

	public get advancedDialog() {
		if (!this._advancedDialog) {
			this._advancedDialog = this._instantiationService.createInstance(
				OptionsDialog, localize('connectionAdvancedProperties', "Advanced Properties"), TelemetryKeys.ModalDialogName.ConnectionAdvancedProperties, { hasBackButton: true, cancelLabel: localize('advancedProperties.discard', "Discard") });
			this._advancedDialog.onCloseEvent(() => this._onCloseAdvancedProperties());
			this._advancedDialog.onOk(() => this.handleOnOk());
			this._advancedDialog.render();
		}
		return this._advancedDialog;
	}

	public set advancedDialog(dialog: OptionsDialog) {
		this._advancedDialog = dialog;
	}

	public static connectionOptionToServiceOption(connectionOption: azdata.ConnectionOption): azdata.ServiceOption {
		return {
			name: connectionOption.name,
			displayName: connectionOption.displayName,
			description: connectionOption.description,
			groupName: connectionOption.groupName,
			valueType: connectionOption.valueType,
			defaultValue: connectionOption.defaultValue,
			objectType: undefined,
			categoryValues: connectionOption.categoryValues,
			isRequired: connectionOption.isRequired,
			isArray: undefined,
			onSelectionChange: connectionOption.onSelectionChange
		};
	}
}
