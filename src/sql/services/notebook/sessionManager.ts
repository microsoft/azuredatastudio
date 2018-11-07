'use strict';

import { nb } from 'sqlops';
import { Session } from 'electron';

export class SessionManager implements nb.SessionManager {
	private _sessionManager: nb.SessionManager;

	constructor() {
		
	}
	public get isReady(): boolean {
		return this._sessionManager.isReady;
	}

	public get ready(): Thenable<void> {
		return this._sessionManager.ready;
	}
	public get specs(): nb.IAllKernels {
		return this._sessionManager.specs;
	}

	startNew(options: nb.ISessionOptions): Thenable<nb.ISession> {
		return this._sessionManager.startNew(options);
	}

	shutdown(id: string): Thenable<void> {
		return this.shutdown(id);
	}

}
