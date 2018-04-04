/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { ExtensionContext, languages, IndentAction } from 'vscode';

export function activate(context: ExtensionContext): any {
	languages.setLanguageConfiguration('python', {
		onEnterRules: [
			{
				beforeText: /^\s*(?:def|class|for|if|elif|else|while|try|with|finally|except|async).*?:\s*$/,
				action: { indentAction: IndentAction.Indent }
			}
		]
	});
}