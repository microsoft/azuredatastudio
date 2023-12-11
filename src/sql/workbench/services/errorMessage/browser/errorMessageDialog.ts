/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/errorMessageDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { HideReason, Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

import Severity from 'vs/base/common/severity';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { Action, IAction } from 'vs/base/common/actions';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { onUnexpectedError } from 'vs/base/common/errors';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { Link } from 'vs/platform/opener/browser/link';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { Deferred } from 'sql/base/common/promise';
import { IErrorDialogOptions, MessageLevel } from 'sql/workbench/api/common/sqlExtHostTypes';

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
	private _readMoreLink?: string;
	private _messageDetails?: string;
	private _okLabel: string;
	private _closeLabel: string;
	private _readMoreLabel: string;
	private _promise: Deferred<string> | undefined;

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;

	protected _telemetryView: TelemetryKeys.TelemetryView | string = TelemetryKeys.TelemetryView.ErrorMessageDialog;

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IOpenerService private readonly _openerService: IOpenerService,
	) {
		super('', TelemetryKeys.ModalDialogName.ErrorMessage, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'normal', hasTitleIcon: true, height: 340 });
		this._okLabel = localize('errorMessageDialog.ok', "OK");
		this._closeLabel = localize('errorMessageDialog.close', "Close");
		this._readMoreLabel = localize('errorMessageDialog.readMore', "Read More");

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
	}

	private createCopyButton() {
		let copyButtonLabel = localize('copyDetails', "Copy details");
		this._copyButton = this.addFooterButton(copyButtonLabel, () => {
			if (this._messageDetails) {
				this._clipboardService.writeText(this._messageDetails!).catch(err => onUnexpectedError(err));
			}
		}, 'left', true);
		this._copyButton!.icon = 'codicon scriptToClipboard';
		this._copyButton!.element.title = copyButtonLabel;
	}

	private createStandardButton(label: string, onSelect: () => void): Button {
		let button = this.addFooterButton(label, onSelect, 'right', false);
		return button;
	}

	private onActionSelected(index: number): void {
		if (this._actions && index < this._actions.length) {
			const actionId = this._actions[index].id;
			this._telemetryService.sendActionEvent(this._telemetryView, actionId);
			// Call OK to close dialog.
			this.ok(false);
			// Run the action if possible
			this._actions[index].run();
			// Resolve promise after running action.
			this._promise?.resolve(actionId);
		}
	}

	protected layout(height?: number): void {
		// Nothing to re-layout
	}

	protected updateDialogBody(): void {
		DOM.clearNode(this._body!);
		DOM.append(this._body!, DOM.$('div.error-message')).innerText = this._message!;
		if (this._instructionText) {
			let childElement = DOM.$('div.error-instruction-text');
			childElement.innerText = this._instructionText!;
			if (this._readMoreLink) {
				new Link(childElement, {
					label: this._readMoreLabel,
					href: this._readMoreLink
				}, undefined, this._openerService);
			}
			DOM.append(this._body!, childElement);
		}
	}

	protected getBody(): HTMLElement {
		return this._body;
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

	public ok(resolvePromise: boolean = true): void {
		this._telemetryService.sendActionEvent(this._telemetryView, 'ok');
		this._onOk.fire();
		this.close('ok', resolvePromise);
	}

	public close(hideReason: HideReason = 'close', resolvePromise: boolean) {
		this._telemetryService.sendActionEvent(this._telemetryView, hideReason.toString());
		this.hide(hideReason);
		if (resolvePromise) {
			this._promise?.resolve(hideReason.toString());
		}
	}

	public open(telemetryView: TelemetryKeys.TelemetryView | string, severity: Severity, headerTitle: string, message: string, messageDetails?: string,
		actions?: IAction[], instructionText?: string, readMoreLink?: string, resetActions: boolean = true): void {
		this._telemetryView = telemetryView;
		this._severity = severity;
		this._message = message;
		this._instructionText = instructionText;
		this._readMoreLink = readMoreLink;
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
		if (resetActions) {
			this.resetActions();
		}
		if (actions?.length > 0) {
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
		this.updateIconTitle();
		this.updateDialogBody();
		this.show();
		if (actions?.length > 0) {
			this._actionButtons[0].focus();
		} else {
			this._okButton!.focus();
		}
	}

	public openCustomAsync(options: IErrorDialogOptions): Promise<string | undefined> {
		if (!options) {
			return undefined;
		}

		let actions: IAction[] = [];
		this.resetActions();
		options.actions?.forEach(action => {
			actions.push(new Action(action.id, action.label, '', true, () => { }));
		});

		this.open(options.telemetryView, this.convertToSeverity(options.severity),
			options.headerTitle, options.message, options.messageDetails, actions,
			options.instructionText, options.readMoreLink, false);

		const deferred = new Deferred<string | undefined>();
		this._promise = deferred;
		return this._promise.promise;
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

	private resetActions(): void {
		this._actions = [];
		for (let actionButton of this._actionButtons) {
			actionButton.element.style.visibility = 'hidden';
		}
	}

	public override dispose(): void {
	}
}
