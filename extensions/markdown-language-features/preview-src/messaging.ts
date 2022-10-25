/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SettingsManager } from './settings';

export interface MessagePoster {
	/**
	 * Post a message to the markdown extension
	 */
	postMessage(type: string, body: object): void;
}

export const createPosterForVsCode = (vscode: any, settingsManager: SettingsManager) => {
	return new class implements MessagePoster {
		postMessage(type: string, body: object): void {
			vscode.postMessage({
				type,
				source: settingsManager.settings!.source,
				body
			});
		}
	};
};

