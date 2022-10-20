/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/tableDesignerPublishDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Mimes } from 'vs/base/common/mime';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import * as azdata from 'azdata';
import { attachCheckboxStyler } from 'sql/platform/theme/common/styler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { MarkdownRenderer } from 'vs/editor/contrib/markdownRenderer/browser/markdownRenderer';

const OkText: string = localize('tableDesigner.UpdateDatabase', "Update Database");
const CancelText: string = localize('tableDesigner.cancel', "Cancel");
const GenerateScriptText: string = localize('tableDesigner.generateScript', "Generate Script");

export enum TableDesignerPublishDialogResult {
	UpdateDatabase,
	GenerateScript,
	Cancel
}

export class TableDesignerPublishDialog extends Modal {

	private _report?: azdata.designers.GeneratePreviewReportResult;
	private _okButton?: Button;
	private _generateScriptButton?: Button;
	private _cancelButton?: Button;
	private _promiseResolver: (value: TableDesignerPublishDialogResult) => void;
	private readonly _markdownRenderer: MarkdownRenderer;

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super('', TelemetryKeys.ModalDialogName.TableDesignerPublishDialog, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'normal', hasTitleIcon: false });
		this._markdownRenderer = instantiationService.createInstance(MarkdownRenderer, {});
	}

	public open(report: azdata.designers.GeneratePreviewReportResult): Promise<TableDesignerPublishDialogResult> {
		this._report = report;
		this.render();
		this.show();
		const promise = new Promise<TableDesignerPublishDialogResult>((resolve) => {
			this._promiseResolver = resolve;
		});
		return promise;
	}

	public override render() {
		super.render();
		this.title = localize('tableDesigner.previewDatabaseUpdates', "Preview Database Updates");
		this._register(attachModalDialogStyler(this, this._themeService));
		this._okButton = this.addFooterButton(OkText, () => this.handleOkButtonClick());
		this._generateScriptButton = this.addFooterButton(GenerateScriptText, () => this.handleGenerateScriptButtonClick(), 'right', true);
		this._cancelButton = this.addFooterButton(CancelText, () => this.handleCancelButtonClick(), 'right', true);
		const requireConfirmation = this._report.requireConfirmation === true;
		this._okButton.enabled = !requireConfirmation;
		this._generateScriptButton.enabled = !requireConfirmation;
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this._register(attachButtonStyler(this._generateScriptButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));
	}

	protected renderBody(container: HTMLElement) {
		const body = DOM.append(container, DOM.$('.table-designer-publish-dialog'));
		const reportContainer = DOM.append(body, DOM.$('.report-container'));
		if (this._report.mimeType === Mimes.markdown) {
			const markdownElement = this._markdownRenderer.render({ value: this._report.report }).element;
			DOM.append(reportContainer, markdownElement);
		} else {
			// default to plain text
			reportContainer.innerText = this._report.report;
		}
		if (this._report.requireConfirmation && this._report.confirmationText) {
			const checkboxContainer = DOM.append(body, DOM.$('div'));
			const checkbox = new Checkbox(checkboxContainer, {
				label: this._report.confirmationText,
				checked: false
			});
			this._register(checkbox.onChange((checked) => {
				this._okButton.enabled = checked;
				this._generateScriptButton.enabled = checked;
			}));
			this._register(attachCheckboxStyler(checkbox, this._themeService));
		}
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	/* espace key */
	protected override onClose() {
		this.handleCancelButtonClick();
	}

	/* enter key */
	protected override onAccept() {
		this.handleOkButtonClick();
	}

	private handleOkButtonClick(): void {
		this.hide('ok');
		this._promiseResolver(TableDesignerPublishDialogResult.UpdateDatabase);
	}

	private handleGenerateScriptButtonClick(): void {
		this.hide('ok');
		this._promiseResolver(TableDesignerPublishDialogResult.GenerateScript);
	}

	private handleCancelButtonClick(): void {
		this.hide('cancel');
		this._promiseResolver(TableDesignerPublishDialogResult.Cancel);
	}
}
