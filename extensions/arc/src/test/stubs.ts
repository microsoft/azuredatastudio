/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class MockInputBox implements vscode.InputBox {
	private _value: string = '';
	public get value(): string {
		return this._value;
	}
	public set value(newValue: string) {
		this._value = newValue;
		if (this._onDidChangeValueCallback) {
			this._onDidChangeValueCallback(this._value);
		}
	}
	placeholder: string | undefined;
	password: boolean = false;
	private _onDidChangeValueCallback: ((e: string) => any) | undefined = undefined;
	onDidChangeValue: vscode.Event<string> = (listener: (value: string) => void) => {
		this._onDidChangeValueCallback = listener;
		return new vscode.Disposable(() => { });
	};
	private _onDidAcceptCallback: ((e: void) => any) | undefined = undefined;
	public onDidAccept: vscode.Event<void> = (listener: () => void) => {
		this._onDidAcceptCallback = listener;
		return new vscode.Disposable(() => { });
	};
	buttons: readonly vscode.QuickInputButton[] = [];
	onDidTriggerButton: vscode.Event<vscode.QuickInputButton> = () => { return new vscode.Disposable(() => { }); };
	prompt: string | undefined;
	validationMessage: string | undefined;
	title: string | undefined;
	step: number | undefined;
	totalSteps: number | undefined;
	enabled: boolean = false;
	busy: boolean = false;
	ignoreFocusOut: boolean = false;
	valueSelection: readonly [number, number] | undefined = undefined;
	show(): void { }

	hide(): void {
		if (this._onDidHideCallback) {
			this._onDidHideCallback();
		}
	}
	private _onDidHideCallback: ((e: void) => any) | undefined = undefined;
	onDidHide: vscode.Event<void> = (listener: () => void) => {
		this._onDidHideCallback = listener;
		return new vscode.Disposable(() => { });
	};
	dispose(): void { }

	public async triggerAccept(): Promise<any> {
		if (this._onDidAcceptCallback) {
			return await this._onDidAcceptCallback();
		}
		return undefined;
	}
}
