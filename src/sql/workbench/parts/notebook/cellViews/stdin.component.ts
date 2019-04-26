/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./stdin';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import { nb } from 'azdata';
import { localize } from 'vs/nls';

import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { attachInputBoxStyler } from 'sql/platform/theme/common/styler';

import { IInputOptions } from 'vs/base/browser/ui/inputbox/inputBox';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { inputBackground, inputBorder } from 'vs/platform/theme/common/colorRegistry';
import { StandardKeyboardEvent, IKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { AngularDisposable } from 'sql/base/node/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { Deferred } from 'sql/base/common/promise';
import { ICellModel, CellExecutionState } from 'sql/workbench/parts/notebook/models/modelInterfaces';

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
		@Inject(forwardRef(() => ChangeDetectorRef)) private changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(IContextViewService) private contextViewService: IContextViewService,
		@Inject(forwardRef(() => ElementRef)) private el: ElementRef
	) {
		super();
	}

	ngOnInit(): void {

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
		this.onkeydown(this._input.inputElement, (e) => this.handleKeyboardInput(e));
		this._input.focus();
	}
	private handleKeyboardInput(e: IKeyboardEvent): void {
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


	private onkeydown(domNode: HTMLElement, listener: (e: IKeyboardEvent) => void): void {
		this._register(DOM.addDisposableListener(domNode, DOM.EventType.KEY_DOWN, (e: KeyboardEvent) => listener(new StandardKeyboardEvent(e))));
	}

	private get prompt(): string {
		if (this.stdIn && this.stdIn.content && this.stdIn.content.prompt) {
			return this.stdIn.content.prompt;
		}
		return localize('stdInLabel', 'StdIn:');
	}

	private get password(): boolean {
		return this.stdIn && this.stdIn.content && this.stdIn.content.password;
	}
}
