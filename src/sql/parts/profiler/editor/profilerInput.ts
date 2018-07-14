/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { IProfilerSession, IProfilerService, ProfilerSessionID, IProfilerViewTemplate } from 'sql/parts/profiler/service/interfaces';
import { ProfilerState } from './profilerState';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

import * as sqlops from 'sqlops';

import { TPromise } from 'vs/base/common/winjs.base';
import { EditorInput } from 'vs/workbench/common/editor';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Event, Emitter } from 'vs/base/common/event';
import { generateUuid } from 'vs/base/common/uuid';

import * as nls from 'vs/nls';
import { SaveReason } from 'vs/workbench/services/textfile/common/textfiles';
import { IDialogService, IConfirmation, IConfirmationResult } from 'vs/platform/dialogs/common/dialogs';

export class ProfilerInput extends EditorInput implements IProfilerSession {

	public static ID: string = 'workbench.editorinputs.profilerinputs';
	public static SCHEMA: string = 'profiler';
	private _data: TableDataView<Slick.SlickData>;
	private _id: ProfilerSessionID;
	private _state: ProfilerState;
	private _columns: string[] = [];
	private _viewTemplate: IProfilerViewTemplate;
	// mapping of event categories to what column they display under
	// used for coallescing multiple events with different names to the same column
	private _columnMapping: { [event: string]: string } = {};

	private _onColumnsChanged = new Emitter<Slick.Column<Slick.SlickData>[]>();
	public onColumnsChanged: Event<Slick.Column<Slick.SlickData>[]> = this._onColumnsChanged.event;

	constructor(
		private _connection: IConnectionProfile,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IProfilerService private _profilerService: IProfilerService,
		@INotificationService private _notificationService: INotificationService,
		@IDialogService private _dialogService: IDialogService
	) {
		super();
		this._state = new ProfilerState();
		// set inital state
		this.state.change({
			isConnected: true,
			isStopped: true,
			isPaused: false,
			isRunning: false,
			autoscroll: true
		});

		this._id = this._profilerService.registerSession(generateUuid(), _connection, this);
		let searchFn = (val: { [x: string]: string }, exp: string): Array<number> => {
			let ret = new Array<number>();
			for (let i = 0; i < this._columns.length; i++) {
				if (val[this._columns[i]].includes(exp)) {
					ret.push(i);
				}
			}
			return ret;
		};
		this._data = new TableDataView<Slick.SlickData>(undefined, searchFn);

		this.onDispose(() => {
			if (this._state.isRunning || this.state.isPaused) {
				let confirm: IConfirmation = {
					message: nls.localize('confirmStopProfilerSession', "Would you like to stop the running XEvent session?"),
					primaryButton: nls.localize('profilerClosingActions.yes', 'Yes'),
					secondaryButton: nls.localize('profilerClosingActions.no', 'No'),
					type: 'question'
				};

				this._dialogService.confirm(confirm).then(result => {
					if (result.confirmed) {
						this._profilerService.stopSession(this.id);
					}
				});
			}
		});
	}

	public set viewTemplate(template: IProfilerViewTemplate) {
		this._data.clear();
		this._viewTemplate = template;

		let newColumns = this._viewTemplate.columns.reduce<Array<string>>((p, e) => {
			p.push(e.name);
			return p;
		}, []);

		let newMapping: { [event: string]: string } = {};
		this._viewTemplate.columns.forEach(c => {
			c.eventsMapped.forEach(e => {
				newMapping[e] = c.name;
			});
		});
		this.setColumnMapping(newColumns, newMapping);
	}

	public get viewTemplate(): IProfilerViewTemplate {
		return this._viewTemplate;
	}

	public getTypeId(): string {
		return ProfilerInput.ID;
	}

	public resolve(refresh?: boolean): TPromise<IEditorModel> {
		return undefined;
	}

	public getName(): string {
		return nls.localize('profilerInput.profiler', 'Profiler');
	}

	public get data(): TableDataView<Slick.SlickData> {
		return this._data;
	}

	public get columns(): Slick.Column<Slick.SlickData>[] {
		if (this._columns) {
			return this._columns.map(i => {
				return <Slick.Column<Slick.SlickData>>{
					id: i,
					field: i,
					name: i,
					sortable: true
				};
			});
		} else {
			return [];
		}
	}

	public setColumns(columns: Array<string>) {
		this._columns = columns;
		this._onColumnsChanged.fire(this.columns);
	}

	public setColumnMapping(columns: Array<string>, mapping: { [event: string]: string }) {
		this._columns = columns;
		this._columnMapping = mapping;
		this._onColumnsChanged.fire(this.columns);
	}

	public get connectionName(): string {
		if (this._connection !== null) {
			return `${this._connection.serverName} ${this._connection.databaseName}`;
		}
		else {
			return nls.localize('profilerInput.notConnected', "Not connected");
		}
	}

	public get id(): ProfilerSessionID {
		return this._id;
	}

	public get state(): ProfilerState {
		return this._state;
	}

	public onSessionStopped(notification: sqlops.ProfilerSessionStoppedParams) {
		this._notificationService.error(nls.localize("profiler.sessionStopped", "XEvent Profiler Session stopped unexpectedly on the server {0}.", this._connection.serverName));

		this.state.change({
			isStopped: true,
			isPaused: false,
			isRunning: false
		});
	}

	public onSessionStateChanged(state: ProfilerState) {
		this.state.change(state);
	}

	public onMoreRows(eventMessage: sqlops.ProfilerSessionEvents) {
		if (eventMessage.eventsLost) {
			this._notificationService.warn(nls.localize("profiler.eventsLost", "The XEvent Profiler session for {0} has lost events.", this._connection.serverName));
		}

		for (let i: number = 0; i < eventMessage.events.length && i < 500; ++i) {
			let e: sqlops.ProfilerEvent = eventMessage.events[i];
			let data = {};
			data['EventClass'] = e.name;
			data['StartTime'] = e.timestamp;

			// Using ' ' instead of '' fixed the error where clicking through events
			// with empty text fields causes future text panes to be highlighted.
			// This is a temporary fix
			data['TextData'] = ' ';
			for (let key in e.values) {
				let columnName = this._columnMapping[key];
				if (columnName) {
					let value = e.values[key];
					data[columnName] = value;
				}
			}
			this._data.push(data);
		}

	}
}
