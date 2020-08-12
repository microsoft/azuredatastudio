/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Covers defining what the azdata extension exports to other extensions
 *
 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
 * (const enums get evaluated when typescript -> javascript so those are fine)
 */
export const enum extension {
	name = 'Microsoft.azdata'
}

export interface SqlInstanceListResult {
	clusterEndpoint: string,
	externalEndpoint: string,
	name: string,
	status: string,
	vCores: string
}

export interface PostgresServerListResult {
	id: string,
	clusterIP: string,
	externalIP: string,
	mustRestart: boolean,
	name: string,
	status: string
}

export interface AzdataOutput<R> {
	logs: string[],
	result: R[],
	stderr: string[],
	stdout: string[]
}

export interface IExtension {
	postgres: {
		server: {
			list(): Promise<AzdataOutput<PostgresServerListResult>>
		}
	},
	sql: {
		instance: {
			list(): Promise<AzdataOutput<SqlInstanceListResult>>
		}
	}
}
