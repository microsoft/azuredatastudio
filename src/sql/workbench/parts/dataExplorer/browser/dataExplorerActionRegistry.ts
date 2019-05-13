/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IDataExplorerActionDescription {
	category: string;
	commandId: string;
	cssClass?: string;
	label: string;
	isPrimary: boolean;
}

export class DataExplorerActionRegistry {
	private static _actions: IDataExplorerActionDescription[] = [];

	public static registerAction(action: IDataExplorerActionDescription) {
		this._actions.push(action);
	}

	public static getActions(primary: boolean): IDataExplorerActionDescription[] {
		return this._actions.filter(action => primary === action.isPrimary);
	}
}