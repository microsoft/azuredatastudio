/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IDataTransferItem {
	asString(): Thenable<string>;
	value: any;
}

export type IDataTransfer = Map<string, IDataTransferItem>;
