/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IProfilerController {
	findNext(): void;
	findPrevious(): void;
}

export const PROFILER_TABLE_COMMAND_SEARCH = 'profiler.table.action.search';
