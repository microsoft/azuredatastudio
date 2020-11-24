/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ControllerModel } from '../../models/controllerModel';
import { MiaaModel } from '../../models/miaaModel';
import { ConnectToSqlDialog } from './connectSqlDialog';
import * as loc from '../../localizedConstants';

export class ConnectToMiaaSqlDialog extends ConnectToSqlDialog {

	constructor(_controllerModel: ControllerModel, _miaaModel: MiaaModel) {
		super(_controllerModel, _miaaModel);
	}

	protected get providerName(): string {
		return 'MSSQL';
	}

	protected connectionFailedMessage(error: any): string {
		return loc.connectToMSSqlFailed(this.serverNameInputBox.value!, error);
	}
}
