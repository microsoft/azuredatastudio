/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { URI } from 'vs/base/common/uri';

export interface INotebookInput {
	defaultKernel: azdata.nb.IKernelSpec,
	connectionProfile: azdata.IConnectionProfile,
	isDirty(): boolean;
	setDirty(boolean);
	readonly notebookUri: URI;
	updateModel(): void;
	isDirty(): boolean;
	readonly editorOpenedTimestamp: number;
}

export function isINotebookInput(value: any): value is INotebookInput {
	return true;
}
