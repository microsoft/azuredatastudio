/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { Modal, IModalOptions } from 'sql/base/browser/ui/modal/modal';
import { Builder } from 'vs/base/browser/builder';
import { IPartService } from 'vs/workbench/services/part/common/partService';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { attachModalDialogStyler } from '../../common/theme/styler';
import { Wizard, DialogPage, Dialog, OptionsDialogButton } from './dialogTypes';
import { Button } from 'vs/base/browser/ui/button/button';
import { DialogPane } from './dialogPane';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';

export class DialogModal extends Modal {
	private _dialogPane: DialogPane;
	private _isWide: boolean;

	// Wizard HTML elements
	private _body: HTMLElement;

	// Buttons
	private _cancelButton: Button;
	private _doneButton: Button;

	constructor(
		private _dialog: Dialog,
		name: string,
		options: IModalOptions,
		@IPartService partService: IPartService,
		@IWorkbenchThemeService private _themeService: IWorkbenchThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService
	) {
		super(_dialog.title, name, partService, telemetryService, contextKeyService, options);

		if (options && options.isWide) {
			this._isWide = true;
		}
	}

	public layout(): void {

	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		if (this.backButton) {
			this.backButton.onDidClick(() => this.cancel());
			attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND });
		}

		this._cancelButton = this.addFooterButton('Cancel', () => this.cancel());
		this._doneButton = this.addFooterButton('Done', () => this.done());
		attachButtonStyler(this._cancelButton, this._themeService);
		attachButtonStyler(this._doneButton, this._themeService);
	}

	protected renderBody(container: HTMLElement): void {
		new Builder(container).div({ class: 'dialogModal-body' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();

			if (this._isWide) {
				bodyBuilder.addClass('dialogModal-width-wide');
			} else {
				bodyBuilder.addClass('dialogModal-width-normal');
			}
		});

		this._dialogPane = new DialogPane(this._dialog);
		this._dialogPane.createBody(this._body);
	}

	public open(): void {
		this.show();
	}

	public done(): void {
		this.dispose();
		this.hide();
	}

	public cancel(): void {
		this.dispose();
		this.hide();
	}

	protected hide(): void {
		super.hide();
		// this._dialogPane.hide();
	}

	protected show(): void {
		super.show();
		// this._dialogPane.show();
	}

	public dispose(): void {
		super.dispose();
		this._dialogPane.dispose();
	}
}