/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionService, IConnectionProvider, IConnectionProfile, IConnection } from 'sql/platform/connection/common/connectionService';
import { IDisposable } from 'vs/base/common/lifecycle';

export class TestConnectionService implements IConnectionService {
	_serviceBrand: undefined;

	registerProvider(provider: IConnectionProvider): IDisposable {
		throw new Error('Method not implemented.');
	}

	createOrGetConnection(connectionUri: string, profile: IConnectionProfile): IConnection {
		throw new Error('Method not implemented.');
	}

	getIdForConnection(connection: IConnection): string {
		throw new Error('Method not implemented.');
	}

}
