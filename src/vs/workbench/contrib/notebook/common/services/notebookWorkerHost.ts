/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface INotebookWorkerHost {
	// foreign host request
	fhr(method: string, args: any[]): Promise<any>;
}
