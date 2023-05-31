/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/troubleshooterMessageDialog';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { Link } from 'vs/platform/opener/browser/link';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IDialogAction, ITroubleshooterDialogOptions } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ErrorMessageDialog } from 'sql/workbench/services/errorMessage/browser/errorMessageDialog';

export class TroubleshooterMessageDialog extends ErrorMessageDialog {

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IOpenerService openerService: IOpenerService,
		// protected _telemetryView: TelemetryKeys.TelemetryView | string = TelemetryKeys.TelemetryView.TroubleshooterDialog,
	) {
		super(themeService, clipboardService, layoutService, telemetryService, contextKeyService, logService, textResourcePropertiesService, openerService);
	}

	private static TSG_ActionId = 'View Summary';
	private static TSG_ViewSummary = localize('viewSummary', 'View Summary');

	public override openCustomAsync(options: ITroubleshooterDialogOptions): Promise<string | undefined> {

		let runTroubleshootingAction: IDialogAction = {
			id: TroubleshooterMessageDialog.TSG_ActionId,
			label: TroubleshooterMessageDialog.TSG_ViewSummary,
			closeDialog: true
		};

		options.actions = options.actions
			? options.actions.concat(runTroubleshootingAction)
			: [runTroubleshootingAction];

		return super.openCustomAsync(options);
	}

	public override render() {
		super.render();
		this.removeFooterButton(this.getCopyLabel());
	}
}
