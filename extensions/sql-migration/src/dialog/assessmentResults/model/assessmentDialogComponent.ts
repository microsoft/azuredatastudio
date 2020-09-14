/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { MigrationProductType } from '../../../models/product';
import { MigrationStateModel } from '../../../models/stateMachine';

export abstract class AssessmentDialogComponent {
	constructor(protected _model: MigrationStateModel, protected _productType: MigrationProductType) { }
	abstract async createComponent(view: azdata.ModelView): Promise<azdata.Component>;
}
