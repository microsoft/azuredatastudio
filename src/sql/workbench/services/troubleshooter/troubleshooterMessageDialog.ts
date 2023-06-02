/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/troubleshooterMessageDialog';

import * as DOM from 'vs/base/browser/dom';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IDialogAction, ITroubleshooterDialogOptions, ITroubleshooterItem, MessageLevel, State } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ErrorMessageDialog } from 'sql/workbench/services/errorMessage/browser/errorMessageDialog';
import { LoadingSpinner } from 'sql/base/browser/ui/loadingSpinner/loadingSpinner';
import { InfoBox } from 'sql/workbench/browser/ui/infoBox/infoBox';

export class TroubleshooterMessageDialog extends ErrorMessageDialog {

	private _troubleshooterItems: ITroubleshooterItem[];
	private _loadingSpinner: LoadingSpinner;

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
		options.severity = MessageLevel.Information;
		this._troubleshooterItems = options.troubleshooterItems;
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

	protected override renderBody(container: HTMLElement) {
		this.setBody(DOM.append(container, DOM.$('div.troubleshooter-dialog')));
	}

	public override render() {
		super.render();
		this.removeFooterButton(this.getCopyLabel());
	}

	protected override updateDialogBody(): void {
		let item: ITroubleshooterItem;
		let body = this.getBody();
		DOM.clearNode(body!);
		let itemListDiv = DOM.append(body, DOM.$('div.troubleshooter-itemlist'));
		itemListDiv.style.justifyContent = 'left';
		itemListDiv.style.width = 'fit-content';
		itemListDiv.style.height = 'fit-content';
		for (item of this._troubleshooterItems) {
			switch (item.state) {
				case State.Invalid:
					//attach error codicon
					new InfoBox(itemListDiv, { text: item.message, style: 'error' }, this.getOpenerService(), this.logService)
					break;
				case State.Loading:
					//attach loading codicon
					// use loading spinner from account dialog
					this._loadingSpinner = new LoadingSpinner(itemListDiv, { showText: true });
					this._loadingSpinner.loadingMessage = item.message;
					this._loadingSpinner.loading = true;
					break;
				case State.Valid:
					//attach green success codicon
					new InfoBox(itemListDiv, { text: item.message, style: 'success' }, this.getOpenerService(), this.logService)
					break;
			}
		}
	}


}

