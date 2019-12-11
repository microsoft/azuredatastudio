/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export interface IProfilerController {
	findNext(): void;
	findPrevious(): void;
}

export const CONTEXT_PROFILER_EDITOR = new RawContextKey<boolean>('inProfilerTableEditor', false);

export const PROFILER_TABLE_COMMAND_SEARCH = 'profiler.table.action.search';
