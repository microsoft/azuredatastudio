/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import { generateUuid } from 'vs/base/common/uuid';
import { Emitter } from 'vs/base/common/event';

export enum ConnectionState {
	connected,
	connecting,
	disconnected,
	disconnecting
}

export class Connection {
	public readonly id: string;

	private readonly _onStateChange = new Emitter<ConnectionState>();
	public readonly onStateChange = this._onStateChange.event;

	private _state: ConnectionState;

	constructor(public readonly profile: ConnectionProfile, initialState?: ConnectionState, id?: string, public readonly groupId?: string) {
		this._state = initialState || ConnectionState.disconnected;
		this.id = id || generateUuid();
		this.groupId = groupId;
	}

	public get state(): ConnectionState {
		return this._state;
	}

	public updateState(val: ConnectionState): void {
		this._state = val;
	}
}
