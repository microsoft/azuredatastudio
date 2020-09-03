/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';

export interface IResourceViewerStateChangedEvent {

}

export interface INewResourceViewerState {
	// TODO - chgagnon implement state
}

export class ResourceViewerState implements IDisposable {

	private readonly _onResourceViewerStateChange = new Emitter<IResourceViewerStateChangedEvent>();
	public readonly onResourceViewerStateChange = this._onResourceViewerStateChange.event;

	public dispose(): void {
	}

	public change(newState: INewResourceViewerState): void {
		let changeEvent: IResourceViewerStateChangedEvent = {
		};
		let somethingChanged = false;

		if (somethingChanged) {
			this._onResourceViewerStateChange.fire(changeEvent);
		}
	}
}
