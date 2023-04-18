/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

export type MergeEditorLayoutTypes = 'mixed' | 'columns';

export const ctxIsMergeEditor = new RawContextKey<boolean>('isMergeEditor', false, { type: 'boolean', description: localize('is', 'The editor is a merge editor') });
export const ctxMergeEditorLayout = new RawContextKey<MergeEditorLayoutTypes>('mergeEditorLayout', 'mixed', { type: 'string', description: localize('editorLayout', 'The layout mode of a merge editor') });
export const ctxMergeBaseUri = new RawContextKey<string>('mergeEditorBaseUri', '', { type: 'string', description: localize('baseUri', 'The uri of the baser of a merge editor') });
export const ctxMergeResultUri = new RawContextKey<string>('mergeEditorResultUri', '', { type: 'string', description: localize('resultUri', 'The uri of the result of a merge editor') });
