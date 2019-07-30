/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { nb } from 'azdata';

import { CellModel } from 'sql/workbench/parts/notebook/common/models/cell';
import { IClientSession, IClientSessionOptions, ICellModelOptions, ICellModel, IModelFactory } from 'sql/workbench/parts/notebook/common/models/modelInterfaces';
import { ClientSession } from 'sql/workbench/parts/notebook/common/models/clientSession';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class ModelFactory implements IModelFactory {

	constructor(private instantiationService: IInstantiationService) {

	}
	public createCell(cell: nb.ICellContents, options: ICellModelOptions): ICellModel {
		return this.instantiationService.createInstance(CellModel, cell, options);
	}

	public createClientSession(options: IClientSessionOptions): IClientSession {
		return new ClientSession(options);
	}
}
