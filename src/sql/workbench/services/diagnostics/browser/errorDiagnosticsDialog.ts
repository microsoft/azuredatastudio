/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { ErrorMessageDialog } from 'sql/workbench/services/errorMessage/browser/errorMessageDialog';
// import { Link } from 'vs/platform/opener/browser/link';
import { IOpenerService } from 'vs/platform/opener/common/opener';
// import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
// import { mssqlProviderName } from 'sql/platform/connection/common/constants';
// import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { IDialogAction, IErrorDialogOptions } from 'sql/workbench/api/common/sqlExtHostTypes';
import { IErrorDiagnosticsService } from 'sql/workbench/services/diagnostics/common/errorDiagnosticsService';

export class ErrorDiagnosticsDialog extends ErrorMessageDialog {

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IOpenerService openerService: IOpenerService,
		@IErrorDiagnosticsService private _errorDiagnosticsService: IErrorDiagnosticsService,
	) {
		super(themeService, clipboardService, layoutService, telemetryService, contextKeyService, logService, textResourcePropertiesService, openerService);
	}

	private static TSG_ActionId = 'runTroubleshooting';
	private static TSG_RunTroubleshooting = localize('runTroubleshooting', 'Run Troubleshooting');

	private _tsgResponse: string | undefined;

	public override openCustomAsync(options: IErrorDialogOptions): Promise<string> {

		if (!options) {
			return undefined;
		}

		//TODO: change this to view summary button
		let runTroubleshootingAction: IDialogAction = {
			id: ErrorDiagnosticsDialog.TSG_ActionId,
			label: ErrorDiagnosticsDialog.TSG_RunTroubleshooting,
			closeDialog: false,
			run: async () => {
				// this._tsgResponse = await this._errorDiagnosticsService.getAzureDiagnosticsSolution(options.diagnosticsSolutionId);
				// Update layout with Azure service Response
				// this.updateDialogBody();
			}
		};

		options.actions = options.actions
			? options.actions.concat(runTroubleshootingAction)
			: [runTroubleshootingAction];

		return super.openCustomAsync(options);
	}

	protected override updateDialogBody(): void {
		super.updateDialogBody();
		let body = this.getBody();
		if (this._tsgResponse) {
			DOM.append(body!, DOM.$('div.tsg-response')).innerHTML = this._tsgResponse;
			this.hideFooterButtons();
			super.addFooterText('Was it helpful?', 'right');
			super.addFooterButton('Yes', () => {
				this._telemetryService.sendActionEvent(this._telemetryView, 'Yes');
				this.ok(true);
			}, 'right');
			super.addFooterButton('No', () => {
				this._telemetryService.sendActionEvent(this._telemetryView, 'No');
				this.ok(true);
			}, 'right');
		}
	}
}
