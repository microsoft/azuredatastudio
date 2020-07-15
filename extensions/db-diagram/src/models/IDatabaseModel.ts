/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import ITableModel from './ITableModel';



export default interface IDatabaseModel {

	name: string;
	summary: string;
	tables: ITableModel[];

}
