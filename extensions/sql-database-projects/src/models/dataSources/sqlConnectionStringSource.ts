/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataSource } from './dataSources';

export class SqlConnectionDataSource extends DataSource {
	readonly connectionString: string;
	readonly connectionStringComponents: { [id: string]: string } = {};

	public static get type() {
		return 'sql_connection_string';
	}

	constructor(name: string, connectionString: string) {
		super(name);

		// TODO: do we have a common construct for connection strings?
		this.connectionString = connectionString;

		for (const component of this.connectionString.split(';')) {
			const split = component.split('=');

			if (split.length !== 2) {
				throw new Error('Invalid SQL connection string');
			}

			this.connectionStringComponents[split[0]] = split[1];
		}
	}

	public static fromJson(json: DataSourceJson): SqlConnectionDataSource {
		return new SqlConnectionDataSource(json.name, (json.data as unknown as SqlConnectionDataSourceJson).connectionString);
	}
}

interface SqlConnectionDataSourceJson {
	connectionString: string;
}
