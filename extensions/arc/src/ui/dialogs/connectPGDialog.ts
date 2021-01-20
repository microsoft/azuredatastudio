/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerModel } from '../../models/controllerModel';
import { PostgresModel } from '../../models/postgresModel';
import { ConnectToSqlDialog } from './connectSqlDialog';
import * as loc from '../../localizedConstants';

export class ConnectToPGSqlDialog extends ConnectToSqlDialog {

	constructor(_controllerModel: ControllerModel, _postgresModel: PostgresModel) {
		super(_controllerModel, _postgresModel);
	}

	protected get providerName(): string {
		return 'PGSQL';
	}

	protected connectionFailedMessage(error: any): string {
		return loc.connectToPGSqlFailed(this.serverNameInputBox.value!, error);
	}
}
