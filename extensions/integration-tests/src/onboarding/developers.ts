/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

export const developers: string[] = [
	'aaomidi',
	'aasimkhan30',
	'abist',
	'alanrenmsft',
	'anjalia',
	'anthonydresser',
	'Charles-Gagnon',
	'cssuh',
	'ktech99',
	'kburtram',
	'lucyzhang929',
	'smartguest',
	'udeeshagautam',
	'VasuBhog'
];


vscode.commands.registerCommand('integration-tests.onboarding.showDevelopers', () => {
	vscode.window.showInformationMessage(developers.join(' '));
});
