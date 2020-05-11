/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { DatabaseTable } from '../prediction/interfaces';

const TableConfigName = 'MLS_ModelTableConfigName';

export class ModelConfigRecent {
	/**
	 *
	 */
	constructor(private _memento: vscode.Memento) {
	}

	public getModelTable(connection: azdata.connection.ConnectionProfile): DatabaseTable | undefined {
		return this._memento.get<DatabaseTable>(this.getKey(connection));
	}

	public storeModelTable(connection: azdata.connection.ConnectionProfile, table: DatabaseTable): void {
		if (connection && table?.databaseName && table?.tableName && table?.schema) {
			const current = this.getModelTable(connection);
			if (!current || current.databaseName !== table.databaseName || current.tableName !== table.tableName || current.schema !== table.schema) {
				this._memento.update(this.getKey(connection), table);
			}
		}
	}

	private getKey(connection: azdata.connection.ConnectionProfile): string {
		return `${TableConfigName}_${connection.serverName}`;
	}
}
