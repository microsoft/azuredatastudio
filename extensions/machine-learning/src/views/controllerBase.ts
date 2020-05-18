/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

import { ViewBase, LocalPathsEventName } from './viewBase';
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
	public async executeAction<T extends ViewBase>(dialog: T, eventName: string, inputArgs: any, func: (...args: any[]) => Promise<any>, ...args: any[]): Promise<void> {
		const callbackEvent = ViewBase.getCallbackEventName(eventName);
		try {
			let result = await func(...args);
			dialog.sendCallbackRequest(callbackEvent, { inputArgs: inputArgs, data: result });

		} catch (error) {
			dialog.sendCallbackRequest(callbackEvent, { inputArgs: inputArgs, error: error });
		}
	}

	/**
	 * Register common events for views
	 * @param view view
	 */
	public registerEvents(view: ViewBase): void {
		view.on(LocalPathsEventName, async (args) => {
			await this.executeAction(view, LocalPathsEventName, args, this.getLocalPaths, this._apiWrapper, args);
		});
	}

	/**
	 * Returns local file path picked by the user
	 * @param apiWrapper apiWrapper
	 */
	public async getLocalPaths(apiWrapper: ApiWrapper, options: vscode.OpenDialogOptions): Promise<string[]> {
		let result = await apiWrapper.showOpenDialog(options);
		return result ? result?.map(x => x.fsPath) : [];
	}
}
