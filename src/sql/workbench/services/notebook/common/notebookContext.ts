/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from 'vs/platform/contextkey/common/contextkey';

/**
 * Context Keys to use with keybindings for the notebook editor
 */
export const notebookEditorVisibleId = 'notebookEditorVisible';

export const NotebookEditorVisibleContext = new RawContextKey<boolean>(notebookEditorVisibleId, false);

export const NOTEBOOK_COMMAND_SEARCH = 'notebook.command.search';

export const NOTEBOOK_COMMAND_CLOSE_SEARCH = 'notebook.command.closeSearch';

