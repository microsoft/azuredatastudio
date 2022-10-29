/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/errorMessageDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { HideReason, Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

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
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { onUnexpectedError } from 'vs/base/common/errors';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';

const maxActions = 1;

export class ErrorMessageDialog extends Modal {

	private _body?: HTMLElement;
	private _okButton?: Button;
	private _copyButton?: Button;
	private _actionButtons: Button[] = [];
	private _actions: IAction[] = [];
	private _severity?: Severity;
	private _message?: string;
	private _instructionText?: string;
	private _messageDetails?: string;
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
		super('', TelemetryKeys.ModalDialogName.ErrorMessage, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'normal', hasTitleIcon: true });
		this._okLabel = localize('errorMessageDialog.ok', "OK");
		this._closeLabel = localize('errorMessageDialog.close', "Close");
	}

	protected renderBody(container: HTMLElement) {
		this._body = DOM.append(container, DOM.$('div.error-dialog'));
	}

	public override render() {
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
		this._copyButton = this.addFooterButton(copyButtonLabel, () => {
			if (this._messageDetails) {
				this._clipboardService.writeText(this._messageDetails!).catch(err => onUnexpectedError(err));
			}
		}, 'left', true);
		this._copyButton!.icon = {
			id: 'codicon scriptToClipboard'
		};
		this._copyButton!.element.title = copyButtonLabel;
		this._register(attachButtonStyler(this._copyButton!, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND, buttonForeground: SIDE_BAR_FOREGROUND }));
	}

	private createStandardButton(label: string, onSelect: () => void): Button {
		let button = this.addFooterButton(label, onSelect, 'right', false);
		this._register(attachButtonStyler(button, this._themeService));
		return button;
	}

	private onActionSelected(index: number): void {
		// Call OK so it always closes
		this.ok();
		// Run the action if possible
		if (this._actions && index < this._actions.length) {
			this._actions[index].run();
		}
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	private updateDialogBody(): void {
		DOM.clearNode(this._body!);
		DOM.append(this._body!, DOM.$('div.error-message')).innerText = this._message!;
		if (this._instructionText) {
			DOM.append(this._body!, DOM.$('div.error-instruction-text')).innerText = this._instructionText!;
		}
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
	protected override onClose() {
		this.ok();
	}

	/* enter key */
	protected override onAccept() {
		this.ok();
	}

	public ok(): void {
		this._onOk.fire();
		this.close('ok');
	}

	public close(hideReason: HideReason = 'close') {
		this.hide(hideReason);
	}

	public open(severity: Severity, headerTitle: string, message: string, messageDetails?: string, actions?: IAction[], instructionText?: string) {
		this._severity = severity;
		this._message = message;
		this._instructionText = instructionText;
		this.title = headerTitle;
		this._messageDetails = messageDetails;
		if (this._messageDetails) {
			this._copyButton!.element.style.visibility = 'visible';
		} else {
			this._copyButton!.element.style.visibility = 'hidden';
		}
		if (this._message) {
			this._bodyContainer.setAttribute('aria-description', this._message);
		}
		this.resetActions();
		if (actions && actions.length > 0) {
			for (let i = 0; i < maxActions && i < actions.length; i++) {
				this._actions.push(actions[i]);
				let button = this._actionButtons[i];
				button.label = actions[i].label;
				button.element.style.visibility = 'visible';
			}
			//Remove and add button again to update style.
			this.removeFooterButton(this._okLabel);
			this.removeFooterButton(this._closeLabel);
			this._okButton = this.addFooterButton(this._closeLabel, () => this.ok(), undefined, true);
		} else {
			//Remove and add button again to update style
			this.removeFooterButton(this._okLabel);
			this.removeFooterButton(this._closeLabel);
			this._okButton = this.addFooterButton(this._okLabel, () => this.ok());
		}
		this._register(attachButtonStyler(this._okButton, this._themeService));
		this.updateIconTitle();
		this.updateDialogBody();
		this.show();
		if (actions && actions.length > 0) {
			this._actionButtons[0].focus();
		} else {
			this._okButton!.focus();
		}
	}

	private resetActions(): void {
		this._actions = [];
		for (let actionButton of this._actionButtons) {
			actionButton.element.style.visibility = 'hidden';
		}
	}

	public override dispose(): void {
	}
}
