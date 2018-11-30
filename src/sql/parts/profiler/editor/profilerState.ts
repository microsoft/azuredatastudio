/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { EventEmitter } from 'sql/base/common/eventEmitter';
import { IDisposable } from 'vs/base/common/lifecycle';

export interface IProfilerStateChangedEvent {
	isConnected?: boolean;
	isRunning?: boolean;
	isPaused?: boolean;
	isStopped?: boolean;
	autoscroll?: boolean;
	isPanelCollapsed?: boolean;
}

export interface INewProfilerState {
	isConnected?: boolean;
	isRunning?: boolean;
	isPaused?: boolean;
	isStopped?: boolean;
	autoscroll?: boolean;
	isPanelCollapsed?: boolean;
}

export class ProfilerState implements IDisposable {
	private static _CHANGED_EVENT = 'changed';

	private _isConnected: boolean;
	private _isRunning: boolean;
	private _isPaused: boolean;
	private _isStopped: boolean;
	private _autoscroll: boolean;
	private _isPanelCollapsed = true;
	private _eventEmitter: EventEmitter;

	public get isConnected(): boolean { return this._isConnected; }
	public get isRunning(): boolean { return this._isRunning; }
	public get isPaused(): boolean { return this._isPaused; }
	public get isStopped(): boolean { return this._isStopped; }
	public get autoscroll(): boolean { return this._autoscroll; }
	public get isPanelCollapsed(): boolean { return this._isPanelCollapsed; }

	constructor() {
		this._eventEmitter = new EventEmitter();
	}

	public dispose(): void {
		this._eventEmitter.dispose();
	}

	public addChangeListener(listener: (e: IProfilerStateChangedEvent) => void): IDisposable {
		return this._eventEmitter.addListener(ProfilerState._CHANGED_EVENT, listener);
	}

	public change(newState: INewProfilerState): void {
		let changeEvent: IProfilerStateChangedEvent = {
			isConnected: false,
			isRunning: false,
			isPaused: false,
			isStopped: false,
			autoscroll: false,
			isPanelCollapsed: false
		};
		let somethingChanged = false;

		if (typeof newState.isConnected !== 'undefined') {
			if (this._isConnected !== newState.isConnected) {
				this._isConnected = newState.isConnected;
				changeEvent.isConnected = true;
				somethingChanged = true;
			}
		}
		if (typeof newState.isRunning !== 'undefined') {
			if (this._isRunning !== newState.isRunning) {
				this._isRunning = newState.isRunning;
				changeEvent.isRunning = true;
				somethingChanged = true;
			}
		}
		if (typeof newState.isPaused !== 'undefined') {
			if (this._isPaused !== newState.isPaused) {
				this._isPaused = newState.isPaused;
				changeEvent.isPaused = true;
				somethingChanged = true;
			}
		}
		if (typeof newState.isStopped !== 'undefined') {
			if (this._isStopped !== newState.isStopped) {
				this._isStopped = newState.isStopped;
				changeEvent.isStopped = true;
				somethingChanged = true;
			}
		}
		if (typeof newState.autoscroll !== 'undefined') {
			if (this._autoscroll !== newState.autoscroll) {
				this._autoscroll = newState.autoscroll;
				changeEvent.autoscroll = true;
				somethingChanged = true;
			}
		}
		if (typeof newState.isPanelCollapsed !== 'undefined') {
			if (this._isPanelCollapsed !== newState.isPanelCollapsed) {
				this._isPanelCollapsed = newState.isPanelCollapsed;
				changeEvent.isPanelCollapsed = true;
				somethingChanged = true;
			}
		}

		if (somethingChanged) {
			this._eventEmitter.emit(ProfilerState._CHANGED_EVENT, changeEvent);
		}
	}
}
