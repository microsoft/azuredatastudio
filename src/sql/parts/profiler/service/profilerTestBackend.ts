/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IProfilerService } from './interfaces';

import { TPromise } from 'vs/base/common/winjs.base';
import * as pfs from 'vs/base/node/pfs';
import * as path from 'path';

import * as sqlops from 'sqlops';

declare var __dirname;

const columns = [
	'EventClass',
	'TextData',
	'ApplicationName',
	'NTUserName',
	'LoginName',
	'CPU',
	'Reads',
	'Writes',
	'Duration',
	'ClientProcessID',
	'SPID',
	'StartTime',
	'EndTime',
	'BinaryData'
];

export class ProfilerTestBackend implements sqlops.ProfilerProvider {
	public readonly providerId = 'MSSQL';
	private index = 0;
	private timeOutMap = new Map<string, NodeJS.Timer>();
	private testData: Array<Array<string>> = new Array<Array<string>>();

	constructor(
		@IProfilerService private _profilerService: IProfilerService) { }

	createSession(guid: string, createStatement: string, template: sqlops.ProfilerSessionTemplate): Thenable<boolean> {
		this.timeOutMap.set(guid, this.intervalFn(guid));
		return TPromise.as(true);
	}
	startSession(guid: string, sessionName: string): Thenable<boolean> {
		this.timeOutMap.set(guid, this.intervalFn(guid));
		return TPromise.as(true);
	}

	registerOnSessionEventsAvailable(handler: (response: sqlops.ProfilerSessionEvents) => any) {
		return;
	}

	registerOnSessionStopped(handler: (response: sqlops.ProfilerSessionStoppedParams) => any) {
		return;
	}

	registerOnProfilerSessionCreated(handler: (response: sqlops.ProfilerSessionCreatedParams) => any) {
		return;
	}

	private intervalFn(guid: string): NodeJS.Timer {
		return setTimeout(() => {
			let data = this.testData[this.index++];
			let formattedData = {
				EventClass: data[0].trim()
			};

			for (let i = 1; i < data.length; i++) {
				formattedData[columns[i]] = data[i];
			}

			//this._profilerService.onMoreRows({ uri: guid, rowCount: 1, data: formattedData });


			if (this.index >= this.testData.length) {
				this.index = 0;
			}
			this.timeOutMap.set(guid, this.intervalFn(guid));
		}, Math.floor(Math.random() * 1000) + 300);
	}

	stopSession(guid: string): Thenable<boolean> {
		clearTimeout(this.timeOutMap.get(guid));
		this.index = 0;
		return TPromise.as(true);
	}

	pauseSession(guid: string): Thenable<boolean> {
		clearTimeout(this.timeOutMap.get(guid));
		return TPromise.as(true);
	}

	getXEventSessions(guid: string): Thenable<string[]> {
		let retVal = [''];
		return TPromise.as(retVal);
	}

	connectSession(): Thenable<boolean> {
		if (this.testData.length === 0) {
			return new TPromise<boolean>((resolve, reject) => {
				pfs.readFile(path.join(__dirname, 'testData.tsv')).then(result => {
					let tabsep = result.toString().split('\t');
					for (let i = 0; i < tabsep.length; i++) {
						if (i % columns.length === 0) {
							this.testData[i / columns.length] = new Array<string>();
						}
						this.testData[Math.floor(i / columns.length)][i % columns.length] = tabsep[i];
					}
					resolve(true);
				});
			});
		} else {
			return TPromise.as(true);
		}
	}

	disconnectSession(guid: string): Thenable<boolean> {
		clearTimeout(this.timeOutMap.get(guid));
		this.index = 0;
		return TPromise.as(true);
	}
}
