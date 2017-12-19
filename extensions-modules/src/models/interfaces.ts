/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export interface ILogger {
	logDebug(message: string): void;
	increaseIndent(): void;
	decreaseIndent(): void;
	append(message?: string): void;
	appendLine(message?: string): void;
}
