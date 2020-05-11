/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export class EventEmitterCollection extends vscode.Disposable {
	private _events: Map<string, vscode.EventEmitter<any>[]> = new Map<string, vscode.EventEmitter<any>[]>();

	/**
	 *
	 */
	constructor() {
		super(() => this.dispose());
	}

	public on(evt: string, listener: (e: any) => any, thisArgs?: any): vscode.EventEmitter<any> {
		if (!this._events.has(evt)) {
			this._events.set(evt, []);
		}
		let eventEmitter = new vscode.EventEmitter<any>();
		eventEmitter.event(listener, thisArgs);
		this._events.get(evt)?.push(eventEmitter);
		return eventEmitter;
	}

	public fire(evt: string, arg?: any) {
		if (!this._events.has(evt)) {
			this._events.set(evt, []);
		}
		this._events.get(evt)?.forEach(eventEmitter => {
			eventEmitter.fire(arg);
		});
	}

	public disposeEvent(evt: string, emitter: vscode.EventEmitter<any>): void {
		if (this._events.has(evt)) {
			const emitters = this._events.get(evt);
			if (emitters) {
				this._events.set(evt, emitters.filter(x => x !== emitter));
			}
		}
		emitter.dispose();
	}

	public dispose(): any {
		this._events.forEach(events => {
			events.forEach(event => {
				event.dispose();
			});
		});
	}
}
