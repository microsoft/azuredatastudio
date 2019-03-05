/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

interface NodeRequire {
	toUrl(path: string): string;
	(dependencies: string[], callback: (...args: any[]) => any, errorback?: (err: any) => void): any;
	config(data: any): any;
}

declare var require: NodeRequire;