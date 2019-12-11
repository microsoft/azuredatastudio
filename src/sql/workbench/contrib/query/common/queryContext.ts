/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

/**
 * Context Keys to use with keybindings for the results grid and messages used in query and edit data views
 */
export const queryEditorVisibleId = 'queryEditorVisible';
export const resultsVisibleId = 'resultsVisible';
export const resultsGridFocussedId = 'resultsGridFocussed';
export const resultsMessagesFocussedId = 'resultsMessagesFocussed';

export const QueryEditorVisibleContext = new RawContextKey<boolean>(queryEditorVisibleId, false);
export const ResultsVisibleContext = new RawContextKey<boolean>(resultsVisibleId, false);
export const ResultsGridFocussedContext = new RawContextKey<boolean>(resultsGridFocussedId, false);
export const ResultsMessagesFocussedContext = new RawContextKey<boolean>(resultsMessagesFocussedId, false);
