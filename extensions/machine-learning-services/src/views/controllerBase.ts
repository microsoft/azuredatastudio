/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ViewBase, LocalFileEventName, LocalFolderEventName } from './viewBase';
import { ApiWrapper } from '../common/apiWrapper';

/**
 * Base classes for UI controllers
 */
export abstract class ControllerBase {

	/**
	 * creates new instance
	 */
	constructor(protected _apiWrapper: ApiWrapper) {
	}

	/**
	 * Executes an action and sends back callback event to the view
	 */
	public async executeAction<T extends ViewBase>(dialog: T, eventName: string, func: (...args: any[]) => Promise<any>, ...args: any[]): Promise<void> {
		const callbackEvent = ViewBase.getCallbackEventName(eventName);
		try {
			let result = await func(...args);
			dialog.sendCallbackRequest(callbackEvent, { data: result });

		} catch (error) {
			dialog.sendCallbackRequest(callbackEvent, { error: error });
		}
	}

	/**
	 * Register common events for views
	 * @param view view
	 */
	public registerEvents(view: ViewBase): void {
		view.on(LocalFileEventName, async () => {
			await this.executeAction(view, LocalFileEventName, this.getLocalFilePath, this._apiWrapper);
		});
		view.on(LocalFolderEventName, async () => {
			await this.executeAction(view, LocalFolderEventName, this.getLocalFolderPath, this._apiWrapper);
		});
	}

	/**
	 * Returns local file path picked by the user
	 * @param apiWrapper apiWrapper
	 */
	public async getLocalFilePath(apiWrapper: ApiWrapper): Promise<string> {
		let result = await apiWrapper.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false
		});
		return result && result.length > 0 ? result[0].fsPath : '';
	}

	/**
	 * Returns local folder path picked by the user
	 * @param apiWrapper apiWrapper
	 */
	public async getLocalFolderPath(apiWrapper: ApiWrapper): Promise<string> {
		let result = await apiWrapper.showOpenDialog({
			canSelectFiles: false,
			canSelectFolders: true,
			canSelectMany: false
		});
		return result && result.length > 0 ? result[0].fsPath : '';
	}
}
