/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as sqlops from 'sqlops';

export abstract class DacFxWizard {

	public async abstract start(p: any, ...args: any[]);

	public static async getService(): Promise<sqlops.DacFxServicesProvider> {
		let currentConnection = await sqlops.connection.getCurrentConnection();
		let service = sqlops.dataprotocol.getProvider<sqlops.DacFxServicesProvider>(currentConnection.providerName, sqlops.DataProviderType.DacFxServicesProvider);
		return service;
	}

	public abstract registerNavigationValidator(validator: (pageChangeInfo: sqlops.window.modelviewdialog.WizardPageChangeInfo) => boolean);
}





