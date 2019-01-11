/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';

import { CellModel } from './cell';
import { IClientSession, IClientSessionOptions, ICellModelOptions, ICellModel, IModelFactory } from './modelInterfaces';
import { ClientSession } from './clientSession';

export class ModelFactory implements IModelFactory {

	public createCell(cell: nb.ICellContents, options: ICellModelOptions): ICellModel {
		return new CellModel(this, cell, options);
	}

	public createClientSession(options: IClientSessionOptions): IClientSession {
		return new ClientSession(options);
	}
}
