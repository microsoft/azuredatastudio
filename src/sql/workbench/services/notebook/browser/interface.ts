/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { URI } from 'vs/base/common/uri';
import { Event } from 'vs/base/common/event';
import { IContentLoader } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';

export interface INotebookInput {
	defaultKernel?: azdata.nb.IKernelSpec,
	connectionProfile?: azdata.IConnectionProfile,
	isDirty(): boolean;
	setDirty(boolean);
	readonly notebookUri: URI;
	updateModel(): void;
	readonly editorOpenedTimestamp: number;
	readonly layoutChanged: Event<void>;
	readonly contentLoader: IContentLoader;
	readonly standardKernels: IStandardKernelWithProvider[];
	readonly providersLoaded: Promise<void>;
}

export function isINotebookInput(value: any): value is INotebookInput {
	if (
		(typeof value.defaultKernel === 'object' || value.defaultKernel === undefined) &&
		(typeof value.connectionProfile === 'object' || value.connectionProfile === undefined) &&
		typeof value.notebookUri === 'object' &&
		typeof value.isDirty === 'function' &&
		typeof value.layoutChanged === 'function' &&
		typeof value.editorOpenedTimestamp === 'number' &&
		typeof value.contentLoader === 'object' &&
		typeof value.standardKernels === 'object') {
		return true;
	}
	return false;
}
