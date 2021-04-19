// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as Strings from './strings';

export const output = vscode.window.createOutputChannel(Strings.extensionName);

export function showErrorMessage(message: string, ...items: string[]): void {
	vscode.window.showErrorMessage(message, ...items);
}
