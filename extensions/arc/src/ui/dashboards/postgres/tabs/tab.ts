/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ControllerModel } from '../../../../models/controllerModel';
import { DatabaseModel } from '../../../../models/databaseModel';

export abstract class Tab {
	constructor(protected controllerModel: ControllerModel, protected databaseModel: DatabaseModel) { }
	abstract tab(view: azdata.ModelView): Promise<azdata.DashboardTab>;
}
