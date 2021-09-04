/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
declare module 'arc' {

	/**
	 * Covers defining what the arc extension exports to other extensions
	 *
	 * IMPORTANT: THIS IS NOT A HARD DEFINITION unlike vscode; therefore no enums or classes should be defined here
	 * (const enums get evaluated when typescript -> javascript so those are fine)
	 */
	export const enum extension {
		name = 'Microsoft.arc'
	}
	export const enum ResourceType {
		dataControllers = 'dataControllers',
		postgresInstances = 'postgresInstances',
		sqlManagedInstances = 'sqlManagedInstances'
	}

	export type MiaaResourceInfo = ResourceInfo & {
		userName?: string
	};

	export type PGResourceInfo = ResourceInfo & {
		userName?: string
	};

	export type ResourceInfo = {
		name: string,
		resourceType: ResourceType | string,
		connectionId?: string
	};

	export type ControllerInfo = {
		id: string,
		kubeConfigFilePath: string,
		kubeClusterContext: string,
		namespace: string,
		name: string,
		resources: ResourceInfo[]
	};

	export interface DataController {
		label: string,
		info: ControllerInfo
	}
	export interface IExtension {
		getRegisteredDataControllers(): Promise<DataController[]>;
	}
}
