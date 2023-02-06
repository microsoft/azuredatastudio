/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import Severity from 'vs/base/common/severity';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IAction } from 'vs/base/common/actions';

import { ErrorMessageDialog } from 'sql/workbench/services/errorMessage/browser/errorMessageDialog';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { IErrorDialogOptions, MessageLevel } from 'sql/workbench/api/common/sqlExtHostTypes';

export class ErrorMessageService implements IErrorMessageService {

	_serviceBrand: undefined;

	private _errorDialog?: ErrorMessageDialog;

	private handleOnOk(): void {
	}

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService
	) { }

	public showDialog(severity: Severity, headerTitle: string, message: string, messageDetails?: string, telemetryView: TelemetryView = TelemetryView.ErrorMessageDialog, actions?: IAction[], instructionText?: string, readMoreLink?: string): void {
		this.doShowDialog(telemetryView, severity, headerTitle, message, messageDetails, actions, instructionText, readMoreLink);
	}

	private doShowDialog(telemetryView: TelemetryView, severity: Severity, headerTitle: string, message: string, messageDetails?: string, actions?: IAction[], instructionText?: string, readMoreLink?: string): void {
		if (!this._errorDialog) {
			this._errorDialog = this._instantiationService.createInstance(ErrorMessageDialog);
			this._errorDialog.onOk(() => this.handleOnOk());
			this._errorDialog.render();
		}

		let title = headerTitle ? headerTitle : this.getDefaultTitle(severity);
		return this._errorDialog.open(telemetryView, severity, title, message, messageDetails, actions, instructionText, readMoreLink);
	}

	public async showDialogAsync(options: IErrorDialogOptions): Promise<string | undefined> {
		let dialog = this._instantiationService.createInstance(ErrorMessageDialog);
		dialog.render();
		let result = await dialog.openCustomAsync(TelemetryView.ConnectionErrorDialog, this.convertToSeverity(options.severity), options);
		return result;
	}

	private getDefaultTitle(severity: Severity) {
		switch (severity) {
			case Severity.Error:
				return localize('error', "Error");
			case Severity.Warning:
				return localize('warning', "Warning");
			case Severity.Info:
				return localize('info', "Info");
			case Severity.Ignore:
				return localize('ignore', "Ignore");
		}
	}

	private convertToSeverity(messageLevel: MessageLevel): Severity {
		let severity: Severity = Severity.Error;
		switch (messageLevel) {
			case MessageLevel.Error:
				severity = Severity.Error;
				break;
			case MessageLevel.Information:
				severity = Severity.Info;
				break;
			case MessageLevel.Warning:
				severity = Severity.Warning;
				break;
		}
		return severity;
	}
}
