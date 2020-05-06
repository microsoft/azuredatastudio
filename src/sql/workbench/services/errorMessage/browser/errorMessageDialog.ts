/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/errorMessageDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';

import Severity from 'vs/base/common/severity';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { SIDE_BAR_BACKGROUND, SIDE_BAR_FOREGROUND } from 'vs/workbench/common/theme';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { IAction } from 'vs/base/common/actions';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { onUnexpectedError } from 'vs/base/common/errors';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

const maxActions = 1;

export class ErrorMessageDialog extends Modal {

	private _body: HTMLElement;
	private _okButton: Button;
	private _copyButton: Button;
	private _actionButtons: Button[];
	private _actions: IAction[];
	private _severity: Severity;
	private _message: string;
	private _messageDetails: string;
	private _okLabel: string;
	private _closeLabel: string;

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super('', TelemetryKeys.ErrorMessage, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { isFlyout: false, hasTitleIcon: true });
		this._okLabel = localize('errorMessageDialog.ok', "OK");
		this._closeLabel = localize('errorMessageDialog.close', "Close");
	}

	protected renderBody(container: HTMLElement) {
		this._body = DOM.append(container, DOM.$('div.error-dialog'));
	}

	public render() {
		super.render();
		this._register(attachModalDialogStyler(this, this._themeService));
		this.createCopyButton();
		this._actionButtons = [];
		for (let i = 0; i < maxActions; i++) {
			this._actionButtons.unshift(this.createStandardButton(localize('errorMessageDialog.action', "Action"), () => this.onActionSelected(i)));
		}
		this._okButton = this.addFooterButton(this._okLabel, () => this.ok());
		this._register(attachButtonStyler(this._okButton, this._themeService));
	}

	private createCopyButton() {
		let copyButtonLabel = localize('copyDetails', "Copy details");
		this._copyButton = this.addFooterButton(copyButtonLabel, () => this._clipboardService.writeText(this._messageDetails).catch(err => onUnexpectedError(err)), 'left');
		this._copyButton.icon = 'codicon scriptToClipboard';
		this._copyButton.element.title = copyButtonLabel;
		this._register(attachButtonStyler(this._copyButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND, buttonForeground: SIDE_BAR_FOREGROUND }));
	}

	private createStandardButton(label: string, onSelect: () => void): Button {
		let button = this.addFooterButton(label, onSelect, 'right');
		this._register(attachButtonStyler(button, this._themeService));
		return button;
	}

	private onActionSelected(index: number): void {
		// Call OK so it always closes
		this.ok();
		// Run the action if possible
		if (this._actions && index < this._actions.length) {
			this._actions[index].run().catch(err => onUnexpectedError(err));
		}
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	private updateDialogBody(): void {
		DOM.clearNode(this._body);
		DOM.append(this._body, DOM.$('div.error-message')).innerText = this._message;
	}

	private updateIconTitle(): void {
		switch (this._severity) {
			case Severity.Error:
				this.titleIconClassName = 'sql codicon error';
				break;
			case Severity.Warning:
				this.titleIconClassName = 'sql codicon warning';
				break;
			case Severity.Info:
				this.titleIconClassName = 'sql codicon info';
				break;
		}
	}

	/* espace key */
	protected onClose() {
		this.ok();
	}

	/* enter key */
	protected onAccept() {
		this.ok();
	}

	public ok(): void {
		this._onOk.fire();
		this.close();
	}

	public close() {
		this.hide();
	}

	public open(severity: Severity, headerTitle: string, message: string, messageDetails: string, actions: IAction[]) {
		this._severity = severity;
		this._message = message;
		this.title = headerTitle;
		this._messageDetails = messageDetails;
		if (this._messageDetails) {
			this._copyButton.element.style.visibility = 'visible';
		} else {
			this._copyButton.element.style.visibility = 'hidden';
		}
		this.resetActions();
		if (actions && actions.length > 0) {
			for (let i = 0; i < maxActions && i < actions.length; i++) {
				this._actions.push(actions[i]);
				let button = this._actionButtons[i];
				button.label = actions[i].label;
				button.element.style.visibility = 'visible';
			}
			this._okButton.label = this._closeLabel;
		} else {
			this._okButton.label = this._okLabel;
		}
		this.updateIconTitle();
		this.updateDialogBody();
		this.show();
		this._okButton.focus();
	}

	private resetActions(): void {
		this._actions = [];
		for (let actionButton of this._actionButtons) {
			actionButton.element.style.visibility = 'hidden';
		}
	}

	public dispose(): void {
	}
}
