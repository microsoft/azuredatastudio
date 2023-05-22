/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/troubleshooterMessageDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { HideReason, Modal } from 'sql/workbench/browser/modal/modal';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';

import { IThemeService } from 'vs/platform/theme/common/themeService';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { localize } from 'vs/nls';
import { IAction } from 'vs/base/common/actions';
import * as DOM from 'vs/base/browser/dom';
import { ILogService } from 'vs/platform/log/common/log';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { Link } from 'vs/platform/opener/browser/link';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { Deferred } from 'sql/base/common/promise';

const maxActions = 1;

export class TroubleshooterMessageDialog extends Modal {

	private _body?: HTMLElement;
	private _viewRecommendationButton?: Button;
	private _actionButtons: Button[] = [];
	private _actions: IAction[] = [];
	private _message?: string;
	private _instructionText?: string;
	private _readMoreLink?: string;
	private _closeLabel: string;
	private _readMoreLabel: string;
	private _promise: Deferred<string> | undefined;

	private _onOk = new Emitter<void>();
	public onOk: Event<void> = this._onOk.event;

	constructor(
		@IThemeService themeService: IThemeService,
		@IClipboardService clipboardService: IClipboardService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IOpenerService private readonly _openerService: IOpenerService,
		protected _telemetryView: TelemetryKeys.TelemetryView | string = TelemetryKeys.TelemetryView.TroubleshooterDialog,
	) {
		super('', TelemetryKeys.ModalDialogName.Troubleshooter, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, { dialogStyle: 'normal', hasTitleIcon: true });
		this._closeLabel = localize('troubleshooterMessageDialog.close', "Close");
	}

	protected renderBody(container: HTMLElement) {
		this._body = DOM.append(container, DOM.$('div.troubleshooter-dialog'));
	}

	public override render() {
		super.render();
		this._register(attachModalDialogStyler(this, this._themeService));
		this._actionButtons = [];
		for (let i = 0; i < maxActions; i++) {
			this._actionButtons.unshift(this.createStandardButton(localize('errorMessageDialog.action', "Action"), () => this.onActionSelected(i)));
		}
		this._viewRecommendationButton = this.addFooterButton(this._closeLabel, () => this.ok());
		this._register(attachButtonStyler(this._viewRecommendationButton, this._themeService));
	}

	private createStandardButton(label: string, onSelect: () => void): Button {
		let button = this.addFooterButton(label, onSelect, 'right', false);
		this._register(attachButtonStyler(button, this._themeService));
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
		DOM.append(this._body!, DOM.$('div.troubleshooter-message')).innerText = this._message!;
		if (this._instructionText) {
			let childElement = DOM.$('div.troubleshooter-instruction-text');
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

	public open(telemetryView: TelemetryKeys.TelemetryView | string, headerTitle: string, message: string,
		actions?: IAction[], resetActions: boolean = true): void {
		this._telemetryView = telemetryView;
		this._message = 'Diagnostics Report results here';
		this.title = headerTitle;
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
			this.removeFooterButton(this._closeLabel);
			this._viewRecommendationButton = this.addFooterButton(this._closeLabel, () => this.ok(), undefined, true);
		} else {
			//Remove and add button again to update style
			this.removeFooterButton(this._closeLabel);
			this._viewRecommendationButton = this.addFooterButton(this._closeLabel, () => this.ok());
		}
		this.updateDialogBody();
		this.show();
		if (actions?.length > 0) {
			this._actionButtons[0].focus();
		} else {
			this._viewRecommendationButton!.focus();
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
