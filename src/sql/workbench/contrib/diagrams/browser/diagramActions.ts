/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';

import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';

import { IDiagramService } from 'sql/workbench/services/diagrams/common/interfaces';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';

/**
 * ..
 */
export class GetDiagramModelAction extends Action {
	public static ID = 'getDiagramModel';
	public static LABEL = nls.localize('diagram.getDiagramModel', "Get Diagram Model");

	constructor(
		id: string,
		label: string,
		@IDiagramService private _diagramService: IDiagramService,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
		this.enabled = true;
	}

	public run(): Promise<void> {
		const editor = this._editorService.activeEditor;
		if (editor instanceof QueryEditorInput) {
			this._diagramService.getDiagramModel(editor.uri).then(model => {
				model = model;
			});
		}
		return Promise.resolve(null);
	}
}
