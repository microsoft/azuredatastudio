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

export interface DcEndpointListResult {
	description: string,
	endpoint: string,
	name: string,
	protocol: string
}

export interface SqlInstanceListResult {
	name: string,
	replicas: string,
	serverEndpoint: string,
	state: string
}

export interface PostgresServerListResult {
	name: string,
	state: string,
	workers: number
}

export interface AzdataOutput<R> {
	logs: string[],
	result: R[],
	stderr: string[],
	stdout: string[]
}

export interface IExtension {
	dc: {
		endpoint: {
			list(): Promise<AzdataOutput<DcEndpointListResult>>
		}
	}
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
