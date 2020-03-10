/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./stdin';

import {
	Component, Input, Inject,
	ViewChild, ElementRef, AfterViewInit, HostListener
} from '@angular/core';
import { nb } from 'azdata';
import { localize } from 'vs/nls';

import { IInputOptions } from 'vs/base/browser/ui/inputbox/inputBox';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { inputBackground, inputBorder } from 'vs/platform/theme/common/colorRegistry';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';

import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { Deferred } from 'sql/base/common/promise';
import { ICellModel, CellExecutionState } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';

export const STDIN_SELECTOR: string = 'stdin-component';
@Component({
	selector: STDIN_SELECTOR,
	template: `
		<div class="prompt">{{prompt}}</div>
		<div #input class="input"></div>
	`
})
export class StdInComponent extends AngularDisposable implements AfterViewInit {
	private _input: InputBox;
	@ViewChild('input', { read: ElementRef }) private _inputContainer: ElementRef;

	@Input() stdIn: nb.IStdinMessage;
	@Input() onSendInput: Deferred<string>;
	@Input() cellModel: ICellModel;


	constructor(
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService
	) {
		super();
	}

	ngAfterViewInit(): void {
		let inputOptions: IInputOptions = {
			placeholder: '',
			ariaLabel: this.prompt
		};
		this._input = new InputBox(this._inputContainer.nativeElement, this.contextViewService, inputOptions);
		if (this.password) {
			this._input.inputElement.type = 'password';
		}
		this._register(this._input);
		this._register(attachInputBoxStyler(this._input, this.themeService, {
			inputValidationInfoBackground: inputBackground,
			inputValidationInfoBorder: inputBorder,
		}));
		if (this.cellModel) {
			this._register(this.cellModel.onExecutionStateChange((status) => this.handleExecutionChange(status)));
		}
		this._input.focus();
	}

	@HostListener('document:keydown', ['$event'])
	public handleKeyboardInput(event: KeyboardEvent): void {
		let e = new StandardKeyboardEvent(event);
		switch (e.keyCode) {
			case KeyCode.Enter:
				// Indi
				if (this.onSendInput) {
					this.onSendInput.resolve(this._input.value);
				}
				e.stopPropagation();
				break;
			case KeyCode.Escape:
				if (this.onSendInput) {
					this.onSendInput.reject('');
				}
				e.stopPropagation();
				break;
			default:
				// No-op
				break;
		}
	}

	handleExecutionChange(status: CellExecutionState): void {
		if (status !== CellExecutionState.Running && this.onSendInput) {
			this.onSendInput.reject('');
		}
	}

	private get prompt(): string {
		if (this.stdIn && this.stdIn.content && this.stdIn.content.prompt) {
			return this.stdIn.content.prompt;
		}
		return localize('stdInLabel', "StdIn:");
	}

	private get password(): boolean {
		return this.stdIn && this.stdIn.content && this.stdIn.content.password;
	}
}
