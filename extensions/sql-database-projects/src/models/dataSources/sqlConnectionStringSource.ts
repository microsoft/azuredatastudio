/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DataSource } from './dataSources';
import * as constants from '../../common/constants';

/**
 * Contains information about a SQL connection string data source`
 */
export class SqlConnectionDataSource extends DataSource {
	readonly connectionString: string;
	readonly connectionStringComponents: { [id: string]: string } = {};

	public static get type() {
		return 'sql_connection_string';
	}

	public get type(): string {
		return SqlConnectionDataSource.type;
	}

	public get friendlyName(): string {
		return constants.sqlConnectionStringFriendly;
	}

	constructor(name: string, connectionString: string) {
		super(name);

		// TODO: do we have a common construct for connection strings?
		this.connectionString = connectionString;

		for (const component of this.connectionString.split(';')) {
			const split = component.split('=');

			if (split.length !== 2) {
				throw new Error(constants.invalidSqlConnectionString);
			}

			this.connectionStringComponents[split[0]] = split[1];
		}
	}

	public static fromJson(json: DataSourceJson): SqlConnectionDataSource {
		return new SqlConnectionDataSource(json.name, (json.data as unknown as SqlConnectionDataSourceJson).connectionString);
	}
}

/**
 * JSON structure for a SQL connection string data source
 */
interface SqlConnectionDataSourceJson {
	connectionString: string;
}
