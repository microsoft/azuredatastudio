/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { ExtensionIdentifier } from 'vs/platform/extensions/common/extensions';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export interface ISelectedNotebooksChangeEvent {
	notebook: URI;
	oldKernel: string | undefined;
	newKernel: string | undefined;
}

export interface INotebookKernelMatchResult {
	readonly selected: INotebookKernel | undefined;
	readonly suggestions: INotebookKernel[];
	readonly all: INotebookKernel[];
}


export interface INotebookKernelChangeEvent {
	label?: true;
	description?: true;
	detail?: true;
	kind?: true;
	supportedLanguages?: true;
	hasExecutionOrder?: true;
}

export const enum NotebookKernelType {
	Resolved,
	Proxy = 1
}

export interface IResolvedNotebookKernel {
	readonly type: NotebookKernelType.Resolved;
	readonly id: string;
	readonly viewType: string;
	readonly onDidChange: Event<Readonly<INotebookKernelChangeEvent>>;
	readonly extension: ExtensionIdentifier;

	readonly localResourceRoot: URI;
	readonly preloadUris: URI[];
	readonly preloadProvides: string[];

	label: string;
	description?: string;
	detail?: string;
	kind?: string;
	supportedLanguages: string[];
	implementsInterrupt?: boolean;
	implementsExecutionOrder?: boolean;

	executeNotebookCellsRequest(uri: URI, cellHandles: number[]): Promise<void>;
	cancelNotebookCellExecution(uri: URI, cellHandles: number[]): Promise<void>;
}

export const enum ProxyKernelState {
	Disconnected = 1,
	Connected = 2,
	Initializing = 3
}

export interface INotebookProxyKernelChangeEvent extends INotebookKernelChangeEvent {
	connectionState?: true;
}

export interface INotebookProxyKernel {
	readonly type: NotebookKernelType.Proxy;
	readonly id: string;
	readonly viewType: string;
	readonly extension: ExtensionIdentifier;
	readonly preloadProvides: string[];
	readonly onDidChange: Event<Readonly<INotebookProxyKernelChangeEvent>>;
	label: string;
	description?: string;
	detail?: string;
	kind?: string;
	supportedLanguages: string[];
	connectionState: ProxyKernelState;
	resolveKernel(uri: URI): Promise<string | null>;
}

export type INotebookKernel = IResolvedNotebookKernel | INotebookProxyKernel;

export interface INotebookTextModelLike { uri: URI; viewType: string }

export const INotebookKernelService = createDecorator<INotebookKernelService>('INotebookKernelService');

export interface INotebookKernelService {
	_serviceBrand: undefined;

	readonly onDidAddKernel: Event<INotebookKernel>;
	readonly onDidRemoveKernel: Event<INotebookKernel>;
	readonly onDidChangeSelectedNotebooks: Event<ISelectedNotebooksChangeEvent>;
	readonly onDidChangeNotebookAffinity: Event<void>;

	registerKernel(kernel: INotebookKernel): IDisposable;

	getMatchingKernel(notebook: INotebookTextModelLike): INotebookKernelMatchResult;

	/**
	 * Returns the selected or only available kernel.
	 */
	getSelectedOrSuggestedKernel(notebook: INotebookTextModelLike): INotebookKernel | undefined;

	/**
	 * Bind a notebook document to a kernel. A notebook is only bound to one kernel
	 * but a kernel can be bound to many notebooks (depending on its configuration)
	 */
	selectKernelForNotebook(kernel: INotebookKernel, notebook: INotebookTextModelLike): void;

	/**
	 * Set the kernel that a notebook should use when it starts up
	 */
	preselectKernelForNotebook(kernel: INotebookKernel, notebook: INotebookTextModelLike): void;

	/**
	 * Bind a notebook type to a kernel.
	 * @param viewType
	 * @param kernel
	 */
	selectKernelForNotebookType(kernel: INotebookKernel, viewType: string): void;

	/**
	 * Set a perference of a kernel for a certain notebook. Higher values win, `undefined` removes the preference
	 */
	updateKernelNotebookAffinity(kernel: INotebookKernel, notebook: URI, preference: number | undefined): void;

}
