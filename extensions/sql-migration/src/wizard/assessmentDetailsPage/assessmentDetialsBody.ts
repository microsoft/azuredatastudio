/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationStateModel } from '../../models/stateMachine';

export class AssessmentDetailsBody {
	private _view!: azdata.ModelView;

	constructor(migrationStateModel: MigrationStateModel) { }

	public createAssessmentDetailsHeader(view: azdata.ModelView): azdata.Component {
		this._view = view;
		const bodyContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
		}).component();

		return bodyContainer;
	}
}
