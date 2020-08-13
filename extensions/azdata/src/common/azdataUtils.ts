/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PostgresServerListResult, SqlInstanceListResult } from '../typings/azdata-ext';

/**
 * Helper function to parse the raw output from the `azdata postgres server list` command
 * @param result The raw JSON result array
 */
export function parsePostgresServerListResult(result: any[]): PostgresServerListResult[] {
	return result.map(r => {
		return {
			id: r['ID'],
			clusterIP: r['clusterIP'],
			externalIP: r['externalIP'],
			mustRestart: r['mustRestart'],
			name: r['name'],
			status: r['status']
		};
	});
}

/**
 * Helper function to parse the raw output from the `azdata sql instance list` command
 * @param result The raw JSON result array
 */
export function parseSqlInstanceListResult(result: any[]): SqlInstanceListResult[] {
	return result.map(r => {
		return {
			clusterEndpoint: r['Cluster Endpoint'],
			externalEndpoint: r['External Endpoint'],
			name: r['Name'],
			status: r['Status'],
			vCores: r['VCores']
		};
	});
}
