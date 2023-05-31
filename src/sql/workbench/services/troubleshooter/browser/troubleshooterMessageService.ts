/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IAction } from 'vs/base/common/actions';

import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { ITroubleshooterMessageService } from 'sql/platform/troubleshooter/common/troubleshooterMessageService';
import { TroubleshooterMessageDialog } from 'sql/workbench/services/troubleshooter/troubleshooterMessageDialog';

export class TroubleshooterMessageService implements ITroubleshooterMessageService {

	_serviceBrand: undefined;

	private _troubleshooterDialog?: TroubleshooterMessageDialog;

	private handleOnOk(): void {
	}

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) { }

	public showDialog(headerTitle: string, message: azdata.window.ITroubleshooterItem, telemetryView: TelemetryView = TelemetryView.ErrorMessageDialog, actions?: IAction[]): void {
		this.doShowDialog(telemetryView, headerTitle, message, actions);
	}

	private doShowDialog(telemetryView: TelemetryView, headerTitle: string, message: azdata.window.ITroubleshooterItem, actions?: IAction[],): void {
		if (!this._troubleshooterDialog) {
			this._troubleshooterDialog = this._instantiationService.createInstance(TroubleshooterMessageDialog);
			this._troubleshooterDialog.onOk(() => this.handleOnOk());
			this._troubleshooterDialog.render();
		}

		let title = headerTitle
		return this._troubleshooterDialog.open(telemetryView, title, message, actions);
	}

}
