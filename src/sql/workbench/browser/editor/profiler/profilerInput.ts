/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { IProfilerSession, IProfilerService, ProfilerSessionID, IProfilerViewTemplate, ProfilerFilter } from 'sql/workbench/services/profiler/browser/interfaces';
import { ProfilerState } from 'sql/workbench/common/editor/profiler/profilerState';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';

import * as azdata from 'azdata';
import * as nls from 'vs/nls';

import { EditorInput } from 'vs/workbench/common/editor/editorInput';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Event, Emitter } from 'vs/base/common/event';
import { generateUuid } from 'vs/base/common/uuid';
import * as types from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { FilterData } from 'sql/workbench/services/profiler/browser/profilerFilter';
import { uriPrefixes } from 'sql/platform/connection/common/utils';

export interface ColumnDefinition extends Slick.Column<Slick.SlickData> {
	name: string;
}

export class ProfilerInput extends EditorInput implements IProfilerSession {

	public static ID: string = 'workbench.editorinputs.profilerinputs';
	public static SCHEMA: string = 'profiler';
	private _data: TableDataView<Slick.SlickData>;
	private _id?: ProfilerSessionID;
	private _state: ProfilerState;
	private _columns: string[] = [];
	private _sessionName?: string;
	private _viewTemplate?: IProfilerViewTemplate;
	// mapping of event categories to what column they display under
	// used for coallescing multiple events with different names to the same column
	private _columnMapping: { [event: string]: string } = {};

	private _onColumnsChanged = new Emitter<Slick.Column<Slick.SlickData>[]>();
	public onColumnsChanged: Event<Slick.Column<Slick.SlickData>[]> = this._onColumnsChanged.event;

	private _initializerSetup: boolean = true;

	private _filter: ProfilerFilter = { clauses: [] };

	constructor(
		public connection: IConnectionProfile | undefined,
		public fileURI: URI | undefined,
		@IProfilerService private _profilerService: IProfilerService,
		@INotificationService private _notificationService: INotificationService
	) {
		super();
		this._state = new ProfilerState();
		// set inital state
		this.state.change({
			isConnected: false,
			isStopped: true,
			isPaused: false,
			isRunning: false,
			autoscroll: true
		});

		this._profilerService.registerSession(uriPrefixes.connection + generateUuid(), connection, this).then((id) => {
			this._id = id;
			this.state.change({ isConnected: true });
		});

		let searchFn = (val: { [x: string]: string }, exp: string): Array<number> => {
			let ret = new Array<number>();
			for (let i = 0; i < this._columns.length; i++) {
				let colVal = val[this._columns[i]];
				if (colVal && colVal.toLocaleLowerCase().indexOf(exp.toLocaleLowerCase()) > -1) {
					ret.push(i);
				}
			}
			return ret;
		};

		let filterFn = (data: Array<Slick.SlickData>): Array<Slick.SlickData> => {
			return FilterData(this._filter, data);
		};

		this._data = new TableDataView<Slick.SlickData>(undefined, searchFn, undefined, filterFn);
	}

	public get providerType(): string | undefined {
		return this.connection ? this.connection.providerName : undefined;
	}

	public setViewTemplate(template: IProfilerViewTemplate) {
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

	public get viewTemplate(): IProfilerViewTemplate | undefined {
		return this._viewTemplate;
	}

	public setSessionName(name: string) {
		if (!this.state.isRunning || !this.state.isPaused) {
			this._sessionName = name;
		}
	}

	public get sessionName(): string | undefined {
		return this._sessionName;
	}

	override get typeId(): string {
		return ProfilerInput.ID;
	}

	public override getName(): string {
		let name: string = nls.localize('profilerInput.profiler', "Profiler");
		if (!this.connection) {
			return name;
		}
		name += ': ' + this.connection.serverName.substring(0, 20);
		return name;
	}

	public getResource(): URI {
		return URI.from({
			scheme: ProfilerInput.SCHEMA,
			path: 'profiler'
		});
	}

	public get data(): TableDataView<Slick.SlickData> {
		return this._data;
	}

	public get columns(): ColumnDefinition[] {
		if (this._columns) {
			return this._columns.map(i => {
				return <ColumnDefinition>{
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

	public get isFileSession(): boolean {
		return !!this.fileURI;
	}

	public get isSetupPhase(): boolean {
		return this._initializerSetup;
	}

	public setInitializerPhase(isSetupPhase: boolean) {
		this._initializerSetup = isSetupPhase;
	}

	public setConnectionState(isConnected: boolean): void {
		this.state.change({
			isConnected: isConnected
		});
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
		if (!types.isUndefinedOrNull(this.connection)) {
			if (this.connection.databaseName) {
				return `${this.connection.serverName} ${this.connection.databaseName}`;
			} else {
				return `${this.connection.serverName}`;
			}
		}
		else {
			return nls.localize('profilerInput.notConnected', "Not connected");
		}
	}

	public get id(): ProfilerSessionID {
		return this._id!;
	}

	public get state(): ProfilerState {
		return this._state;
	}

	public get filter(): ProfilerFilter {
		return this._filter;
	}

	public onSessionStopped(notification: azdata.ProfilerSessionStoppedParams) {
		if (!this.isFileSession) {	// File session do not have serverName, so ignore notification error based off of server
			this._notificationService.error(nls.localize("profiler.sessionStopped", "XEvent Profiler Session stopped unexpectedly on the server {0}.", this.connection.serverName));
		}

		this.state.change({
			isStopped: true,
			isPaused: false,
			isRunning: false
		});
	}

	public onProfilerSessionCreated(params: azdata.ProfilerSessionCreatedParams) {
		if (types.isUndefinedOrNull(params.sessionName) || types.isUndefinedOrNull(params.templateName)) {
			this._notificationService.error(nls.localize("profiler.sessionCreationError", "Error while starting new session"));
		} else {
			this._sessionName = params.sessionName;
			let sessionTemplate = this._profilerService.getSessionTemplates().find((template) => {
				return template.name === params.templateName;
			});
			if (!types.isUndefinedOrNull(sessionTemplate)) {
				let newView = this._profilerService.getViewTemplates().find((view) => {
					return view.name === sessionTemplate!.defaultView;
				});
				if (!types.isUndefinedOrNull(newView)) {
					this.setViewTemplate(newView);
				}
			}

			this.data.clear();
			this.state.change({
				isStopped: false,
				isPaused: false,
				isRunning: true
			});
		}
	}

	public onSessionStateChanged(state: ProfilerState) {
		this.state.change(state);
	}

	public onMoreRows(eventMessage: azdata.ProfilerSessionEvents) {
		if (eventMessage.eventsLost) {
			this._notificationService.warn(nls.localize("profiler.eventsLost", "The XEvent Profiler session for {0} has lost events.", this.connection.serverName));
		}

		let newEvents = [];
		for (let i: number = 0; i < eventMessage.events.length && i < 500; ++i) {
			let e: azdata.ProfilerEvent = eventMessage.events[i];
			let data: { [key: string]: any } = {};
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
			newEvents.push(data);
		}

		if (newEvents.length > 0) {
			this._data.push(newEvents);
		}
	}

	filterSession(filter: ProfilerFilter) {
		this._filter = filter;
		if (this._filter.clauses.length !== 0) {
			this.data.filter();
		} else {
			this.data.clearFilter();
		}
	}

	clearFilter() {
		this._filter = { clauses: [] };
		this.data.clearFilter();
	}

	override dispose() {
		super.dispose();
		this._profilerService.disconnectSession(this.id);
	}

	get resource(): URI | undefined {
		return undefined;
	}
}
