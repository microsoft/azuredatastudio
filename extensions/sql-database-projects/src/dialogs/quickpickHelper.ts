/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';
import * as vscode from 'vscode';

/**
 * Function created out of createProjectFromDatabaseQuickpick for testing purposes
 * @returns true for sdk style project
 * 			false for legacy style project
 * 			undefined for exiting quickpick
 */
export async function getSDKStyleProjectInfo(): Promise<boolean | undefined> {
	let sdkStyle;
	const sdkLearnMoreButton: vscode.QuickInputButton = {
		iconPath: new vscode.ThemeIcon('link-external'),
		tooltip: constants.learnMore
	};
	const quickPick = vscode.window.createQuickPick();
	quickPick.items = [{ label: constants.YesRecommended }, { label: constants.noString }];
	quickPick.title = constants.sdkStyleProject;
	quickPick.ignoreFocusOut = true;
	const disposables: vscode.Disposable[] = [];

	try {
		quickPick.buttons = [sdkLearnMoreButton];
		quickPick.placeholder = constants.SdkLearnMorePlaceholder;

		const sdkStylePromise = new Promise<boolean | undefined>((resolve) => {
			disposables.push(
				quickPick.onDidHide(() => {
					resolve(undefined);
				}),
				quickPick.onDidChangeSelection((item) => {
					resolve(item[0].label === constants.YesRecommended);
				}));

			disposables.push(quickPick.onDidTriggerButton(async () => {
				await vscode.env.openExternal(vscode.Uri.parse(constants.sdkLearnMoreUrl!));
			}));
		});

		quickPick.show();
		sdkStyle = await sdkStylePromise;
		quickPick.hide();
	} finally {
		disposables.forEach(d => d.dispose());
	}

	return sdkStyle;
}
