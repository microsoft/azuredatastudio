/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { Button } from 'sql/base/browser/ui/button/button';
import { IClipboardService } from 'sql/platform/clipboard/common/clipboardService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ILogService } from 'vs/platform/log/common/log';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import * as DOM from 'vs/base/browser/dom';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { attachButtonStyler } from 'vs/platform/theme/common/styler';
import { localize } from 'vs/nls';
import { IInputOptions, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { INotebookView } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';

export class ViewOptionsModal extends Modal {
	private _submitButton: Button;
	private _cancelButton: Button;
	private _optionsMap: { [name: string]: InputBox | Checkbox } = {};
	private _viewNameInput: InputBox;

	constructor(
		private _view: INotebookView,
		@ILogService logService: ILogService,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IClipboardService clipboardService: IClipboardService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextViewService private _contextViewService: IContextViewService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
	) {
		super(
			localize("viewOptionsModal.title", "Configure View"),
			'ViewOptionsModal',
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{ hasErrors: true, hasSpinner: true }
		);
	}

	protected renderBody(container: HTMLElement): void {
		const formWrapper = DOM.$<HTMLDivElement>('div#view-options-form');
		formWrapper.style.padding = '10px';

		DOM.append(container, formWrapper);

		this._viewNameInput = this.createNameInput(formWrapper);

	}

	protected layout(height: number): void {

	}

	protected createNameInput(container: HTMLElement): InputBox {
		return this.createInputBoxHelper(container, localize('viewOptionsModal.name', "View Name"), this._view.name, {
			validationOptions: {
				validation: (value: string) => {
					if (!value) {
						return ({ type: MessageType.ERROR, content: localize('viewOptionsModal.missingRequireField', "This field is required.") });
					}
					if (this._view.name !== value && !this._view.nameAvailable(value)) {
						return ({ type: MessageType.ERROR, content: localize('viewOptionsModal.nameTaken', "This view name has already been taken.") });
					}
					return undefined;
				}
			},
			ariaLabel: localize('viewOptionsModal.name', "View Name")
		});
	}

	private createInputBoxHelper(container: HTMLElement, label: string, defaultValue: string = '', options?: IInputOptions): InputBox {
		const inputContainer = DOM.append(container, DOM.$('.dialog-input-section'));
		DOM.append(inputContainer, DOM.$('.dialog-label')).innerText = label;
		const input = new InputBox(DOM.append(inputContainer, DOM.$('.dialog-input')), this._contextViewService, options);
		input.value = defaultValue;
		return input;
	}

	override render() {
		super.render();

		this._submitButton = this.addFooterButton(localize('save', "Save"), () => this.onSubmitHandler());
		this._cancelButton = this.addFooterButton(localize('cancel', "Cancel"), () => this.onCancelHandler(), 'right', true);

		this._register(attachInputBoxStyler(this._viewNameInput!, this._themeService));
		this._register(attachButtonStyler(this._submitButton, this._themeService));
		this._register(attachButtonStyler(this._cancelButton, this._themeService));

		this._register(this._viewNameInput.onDidChange(v => this.validate()));

		attachModalDialogStyler(this, this._themeService);
		this.validate();
	}

	private validate() {
		let valid = true;

		if (this._viewNameInput.validate()) {
			valid = false;
		}

		this._submitButton.enabled = valid;
	}

	private onSubmitHandler() {
		this._view.name = this._viewNameInput.value;
		this._view.save();

		this.close();
	}

	private onCancelHandler() {
		this.close();
	}

	public close(): void {
		return this.hide();
	}

	public open(): void {
		this.show();
	}

	public override dispose(): void {
		super.dispose();
		for (let key in this._optionsMap) {
			let widget = this._optionsMap[key];
			widget.dispose();
			delete this._optionsMap[key];
		}
	}
}
