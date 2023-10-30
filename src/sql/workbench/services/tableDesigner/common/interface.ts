/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ITelemetryEventProperties } from 'sql/platform/telemetry/common/telemetry';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';


export const SERVICE_ID = 'tableDesignerService';
export const ITableDesignerService = createDecorator<ITableDesignerService>(SERVICE_ID);

export interface TableDesignerProvider extends azdata.designers.TableDesignerProvider { }

export interface ITableDesignerService {
	_serviceBrand: undefined;

	/**
	 * Register a table designer provider
	 */
	registerProvider(providerId: string, provider: TableDesignerProvider): void;

	/**
	 * Unregister a table designer provider
	 */
	unregisterProvider(providerId: string): void;

	/**
	 * Gets a registered table designer provider, throwing if none are registered with the specified ID
	 * @param providerId The id of the registered provider
	 */
	getProvider(providerId: string): TableDesignerProvider;

	/**
	 * Open a table designer for the given table
	 * @param providerId The provider id
	 * @param tableInfo The table information
	 * @param telemetryInfo Telemetry information
	 * @param objectExplorerContext The object explorer context
	 */
	openTableDesigner(providerId: string, tableInfo: azdata.designers.TableInfo, telemetryInfo?: ITelemetryEventProperties, objectExplorerContext?: azdata.ObjectExplorerContext): Promise<void>;
}
