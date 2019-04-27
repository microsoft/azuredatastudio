/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IDataExplorerActionContribution } from 'sql/workbench/parts/dataExplorer/browser/dataExplorer.contribution';

export interface IDataExplorerActionDescription {
	commandId: string;
	cssClass: string;
	label: string;
	isPrimary: boolean;
}

export class DataExplorerActionRegistry {
	private static _actions: IDataExplorerActionDescription[] = [];

	public static registerAction(action: IDataExplorerActionDescription) {
		this._actions.push(action);
	}

	public static getActions(): IDataExplorerActionDescription[] {
		return this._actions;
	}
}