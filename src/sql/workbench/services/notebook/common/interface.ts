/* eslint-disable code-layering */
/* eslint-disable code-import-patterns */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { IContentManager } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { URI } from 'vs/base/common/uri';
import { Event } from 'vs/base/common/event';

export interface INotebookInput {
	defaultKernel: azdata.nb.IKernelSpec,
	connectionProfile: azdata.IConnectionProfile,
	isDirty(): boolean;
	setDirty(boolean);
	readonly notebookUri: URI;
	updateModel(): void;
	isDirty(): boolean;
	readonly editorOpenedTimestamp: number;
	readonly contentManager: IContentManager;
	readonly standardKernels: IStandardKernelWithProvider[];
	readonly layoutChanged: Event<void>;
}

export function isINotebookInput(value: any): value is INotebookInput {
	return true;
}
