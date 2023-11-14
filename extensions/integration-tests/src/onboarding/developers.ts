/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

export const developers: string[] = [
	'aaomidi',
	'aasimkhan30',
	'abist',
	'alanrenmsft',
	'anjalia',
	'anjaligoyal',
	'anthonydresser',
	'bnhoule',
	'caohai',
	'Charles-Gagnon',
	'cssuh',
	'ktech99',
	'kburtram',
	'lewissanchez',
	'lucyzhang929',
	'saiavishkarsreerama',
	'smartguest',
	'stutijain',
	'udeeshagautam',
	'VasuBhog'
];


vscode.commands.registerCommand('integration-tests.onboarding.showDevelopers', () => {
	vscode.window.showInformationMessage(developers.join(' '));
});
