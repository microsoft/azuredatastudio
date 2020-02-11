/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../common/constants';
import { ApiWrapper } from '../common/apiWrapper';
import * as path from 'path';
import { EventEmitterCollection } from '../common/eventEmitter';

export interface CallbackEventArgs {
	data?: any;
	error?: (reason?: any) => void;
}

export const CallEventNamePostfix = 'Callback';


export abstract class ViewBase extends EventEmitterCollection {
	protected _dialog: azdata.window.Dialog | undefined;
	public connection: azdata.connection.ConnectionProfile | undefined;
	public connectionUrl: string = '';

	public componentMaxLength = 350;
	public browseButtonMaxLength = 20;
	public spaceBetweenComponentsLength = 10;

	constructor(protected _apiWrapper: ApiWrapper, protected _root?: string, protected _parent?: ViewBase) {
		super();
		if (this._parent) {
			if (!this._root) {
				this._root = this._parent.root;
			}
			this.connection = this._parent.connection;
			this.connectionUrl = this._parent.connectionUrl;
		}
		this.registerEvents();
	}

	protected getEventNames(): string[] {
		return [];
	}

	protected getCallbackEventNames(): string[] {
		return this.getEventNames().map(eventName => {
			return ViewBase.getCallbackEventName(eventName);
		});
	}

	public static getCallbackEventName(eventName: string) {
		return `${eventName}CallEventNamePostfix`;
	}

	protected registerEvents() {
		if (this._parent) {
			this._dialog = this._parent.dialog;
			const events = this.getEventNames();
			if (events) {
				events.forEach(eventName => {
					this.on(eventName, (arg) => {
						this._parent?.sendRequest(eventName, arg);
					});

				});
			}
			const callbackEvents = this.getCallbackEventNames();
			if (callbackEvents) {
				callbackEvents.forEach(eventName => {
					this._parent?.on(eventName, (arg) => {
						this.sendRequest(eventName, arg);
					});
				});
			}
		}
	}

	public sendRequest(requestType: string, arg: any) {
		this.fire(requestType, arg);
	}

	public sendCallbackRequest(requestType: string, arg: CallbackEventArgs) {
		this.fire(requestType, arg);
	}

	public sendDataRequest<T>(
		eventName: string,
		arg?: any,
		callbackEventName?: string): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			if (!callbackEventName) {
				callbackEventName = ViewBase.getCallbackEventName(eventName);
			}
			this.fire(eventName, arg);
			this.on(callbackEventName, result => {
				let callbackArgs = <CallbackEventArgs>result;
				if (callbackArgs) {
					if (callbackArgs.error) {
						reject(callbackArgs.error);
					} else {
						resolve(<T>callbackArgs.data);
					}
				} else {
					reject('Not supported event args');
				}
			});
		});
	}

	public async getLocationTitle(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return `${connection.serverName} ${connection.databaseName ? connection.databaseName : ''}`;
		}
		return constants.packageManagerNoConnection;
	}

	public getServerTitle(): string {
		if (this.connection) {
			return this.connection.serverName;
		}
		return constants.packageManagerNoConnection;
	}

	private async getCurrentConnectionUrl(): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return await this._apiWrapper.getUriForConnection(connection.connectionId);
		}
		return '';
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	public async loadConnection(): Promise<void> {
		this.connection = await this.getCurrentConnection();
		this.connectionUrl = await this.getCurrentConnectionUrl();
	}

	/**
	 * Dialog model instance
	 */
	public get dialog(): azdata.window.Dialog | undefined {
		return this._dialog;
	}

	public set dialog(value: azdata.window.Dialog | undefined) {
		this._dialog = value;
	}

	public showInfoMessage(message: string): void {
		this.showMessage(message, azdata.window.MessageLevel.Information);
	}

	public showErrorMessage(message: string, error?: any): void {
		this.showMessage(`${message} ${constants.getErrorMessage(error)}`, azdata.window.MessageLevel.Error);
	}

	private showMessage(message: string, level: azdata.window.MessageLevel): void {
		if (this._dialog) {
			this._dialog.message = {
				text: message,
				level: level
			};
		}
	}

	public get root(): string {
		return this._root || '';
	}

	public asAbsolutePath(filePath: string): string {
		return path.join(this._root || '', filePath);
	}

	public abstract reset(): Promise<void>;
}
