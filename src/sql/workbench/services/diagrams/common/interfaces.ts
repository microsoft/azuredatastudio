/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'diagramService';

export const IDiagramService = createDecorator<IDiagramService>(SERVICE_ID);

export enum DiagramObject {
	Schema = 1,
	Database = 2,
	Table = 3
}

export class DiagramRequestParams {
	public ownerUri: string;
	public schema: string;
	public server: string;
	public database: string;
	public table: string;
	public diagramView: DiagramObject;
}

export interface IDiagramService {
	_serviceBrand: undefined;

	registerProvider(providerId: string, provider: azdata.DiagramServicesProvider): void;

	getDiagramModel(diagramRequestParams: DiagramRequestParams): Thenable<azdata.DiagramRequestResult>;
}
