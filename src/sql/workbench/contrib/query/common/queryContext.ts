/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ActiveEditorContext } from 'vs/workbench/common/editor';
import { QueryEditor } from 'sql/workbench/contrib/query/browser/queryEditor';

export const QueryEditorVisible = ActiveEditorContext.isEqualTo(QueryEditor.ID);
export const ResultsVisible = new RawContextKey<boolean>('resultsVisible', false);
export const ResultsGridFocused = new RawContextKey<boolean>('resultsGridFocused', false);
export const ResultsMessagesFocused = new RawContextKey<boolean>('resultsMessagesFocused', false);
