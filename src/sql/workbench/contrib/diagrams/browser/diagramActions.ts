/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { IDiagramService, DiagramRequestParams, DiagramObject } from 'sql/workbench/services/diagrams/common/interfaces';
import { DiagramRequestResult } from 'sql/workbench/api/common/sqlExtHostTypes';

/**
 * Action to get a Diagram Model for a Object Type
 */
export class GetDiagramModelAction extends Action {
	public static ID = 'getDiagramModel';
	public static LABEL = nls.localize('diagram.getDiagramModel', "Get Diagram Model");

	constructor(
		id: string,
		label: string,
		@IDiagramService private _diagramService: IDiagramService
	) {
		super(id, label);
		this.enabled = true;
	}

	public async run(context: any): Promise<DiagramRequestResult> {
		if (context.ownerUri) {
			let diagramModelParams: DiagramRequestParams = {
				ownerUri: context.ownerUri,
				schema: undefined,
				server: undefined,
				database: undefined,
				table: undefined,
				diagramView: DiagramObject.Schema
			};
			const model = await this._diagramService.getDiagramModel(diagramModelParams);
			context.component.exampleModel = model;
			return model;
		}
		return Promise.resolve(null);
	}
}
