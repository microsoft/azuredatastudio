/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as azdata from 'azdata';
import { ProviderId } from './connectionProvider';

const IconId = 'myprovidericon';
export class IconProvider implements azdata.IconProvider {
	public readonly providerId: string = ProviderId;
	public handle?: number;
	getConnectionIconId(connection: azdata.IConnectionProfile, serverInfo: azdata.ServerInfo): Thenable<string | undefined> {
		return Promise.resolve(IconId);
	}
}
