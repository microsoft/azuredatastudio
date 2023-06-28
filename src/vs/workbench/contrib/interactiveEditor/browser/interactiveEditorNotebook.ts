/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { illegalState } from 'vs/base/common/errors';
import { Schemas } from 'vs/base/common/network';
import { isEqual } from 'vs/base/common/resources';
import { IInteractiveEditorSessionService } from 'vs/workbench/contrib/interactiveEditor/browser/interactiveEditorSession';
import { INotebookEditorService } from 'vs/workbench/contrib/notebook/browser/services/notebookEditorService';
import { CellUri } from 'vs/workbench/contrib/notebook/common/notebookCommon';

export class InteractiveEditorNotebookContribution {

	constructor(
		@IInteractiveEditorSessionService sessionService: IInteractiveEditorSessionService,
		@INotebookEditorService notebookEditorService: INotebookEditorService,
	) {

		sessionService.registerSessionKeyComputer(Schemas.vscodeNotebookCell, {
			getComparisonKey: (_editor, uri) => {
				const data = CellUri.parse(uri);
				if (!data) {
					throw illegalState('Expected notebook');
				}
				for (const editor of notebookEditorService.listNotebookEditors()) {
					if (isEqual(editor.textModel?.uri, data.notebook)) {
						return `<notebook>${editor.getId()}#${uri}`;
					}
				}
				throw illegalState('Expected notebook');
			}
		});
	}
}
