/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare const enum LoaderEventType {
	LoaderAvailable = 1,

	BeginLoadingScript = 10,
	EndLoadingScriptOK = 11,
	EndLoadingScriptError = 12,

	BeginInvokeFactory = 21,
	EndInvokeFactory = 22,

	NodeBeginEvaluatingScript = 31,
	NodeEndEvaluatingScript = 32,

	NodeBeginNativeRequire = 33,
	NodeEndNativeRequire = 34,

	CachedDataFound = 60,
	CachedDataMissed = 61,
	CachedDataRejected = 62,
	CachedDataCreated = 63,
}

declare class LoaderEvent {
	readonly type: LoaderEventType;
	readonly timestamp: number;
	readonly detail: string;
}

declare const define: {
	(moduleName: string, dependencies: string[], callback: (...args: any[]) => any): any;
	(moduleName: string, dependencies: string[], definition: any): any;
	(moduleName: string, callback: (...args: any[]) => any): any;
	(moduleName: string, definition: any): any;
	(dependencies: string[], callback: (...args: any[]) => any): any;
	(dependencies: string[], definition: any): any;
};

interface NodeRequire {
	toUrl(path: string): string;

	/**
	 * @deprecated MUST not be used anymore
	 *
	 * With the move from AMD to ESM we cannot use this anymore. There will be NO MORE node require like this.
	 */
	__$__nodeRequire<T>(moduleName: string): T;

	(dependencies: string[], callback: (...args: any[]) => any, errorback?: (err: any) => void): any;
	config(data: any): any;
	onError: Function;
	getStats?(): ReadonlyArray<LoaderEvent>;
	hasDependencyCycle?(): boolean;
	define(amdModuleId: string, dependencies: string[], callback: (...args: any[]) => any): any;
}

declare var require: NodeRequire;
