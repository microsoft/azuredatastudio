/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const SERVICE_ID = 'diagramService';

export const IDiagramService = createDecorator<IDiagramService>(SERVICE_ID);

export interface IDiagramService {
	_serviceBrand: undefined;

	registerProvider(providerId: string, provider: azdata.DiagramServicesProvider): void;

	getDiagramModel(connectionUri: string): Thenable<azdata.ObjectMetadata[]>;
}
