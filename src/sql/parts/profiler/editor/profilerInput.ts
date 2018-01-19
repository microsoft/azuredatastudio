/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { IProfilerSession, IProfilerService, ProfilerSessionID, IProfilerSessionTemplate } from 'sql/parts/profiler/service/interfaces';
import { ProfilerState } from './profilerState';
import { IConnectionProfile } from 'sql/parts/connection/common/interfaces';

import * as sqlops from 'sqlops';

import { TPromise } from 'vs/base/common/winjs.base';
import { EditorInput } from 'vs/workbench/common/editor';
import { IEditorModel } from 'vs/platform/editor/common/editor';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import Event, { Emitter } from 'vs/base/common/event';
import { generateUuid } from 'vs/base/common/uuid';

import * as nls from 'vs/nls';

export class ProfilerInput extends EditorInput implements IProfilerSession {

	public static ID: string = 'workbench.editorinputs.profilerinputs';
	public static SCHEMA: string = 'profiler';
	private _data: TableDataView<Slick.SlickData>;
	private _id: ProfilerSessionID;
	private _state: ProfilerState;
	private _columns: string[] = [];
	private _sessionTemplate: IProfilerSessionTemplate;

	private _onColumnsChanged = new Emitter<Slick.Column<Slick.SlickData>[]>();
	public onColumnsChanged: Event<Slick.Column<Slick.SlickData>[]> = this._onColumnsChanged.event;

	constructor(
		private _connection: IConnectionProfile,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IProfilerService private _profilerService: IProfilerService
	) {
		super();
		this._state = new ProfilerState();
		// set inital state
		this.state.change({
			isConnected: true,
			isStopped: false,
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
	}

	public set sessionTemplate(template: IProfilerSessionTemplate) {
		this._sessionTemplate = template;
		let newColumns = this.sessionTemplate.view.events.reduce<Array<string>>((p, e) => {
			e.columns.forEach(c => {
				if (!p.includes(c)) {
					p.push(c);
				}
			});
			return p;
		}, []);
		newColumns.unshift('EventClass');
		this.setColumns(newColumns);
	}

	public get sessionTemplate(): IProfilerSessionTemplate {
		return this._sessionTemplate;
	}

	public getTypeId(): string {
		return ProfilerInput.ID;
	}

	public resolve(refresh?: boolean): TPromise<IEditorModel> {
		return undefined;
	}

	public getName(): string {
		return nls.localize('profiler', 'Profiler');
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

	public get id(): ProfilerSessionID {
		return this._id;
	}

	public get state(): ProfilerState {
		return this._state;
	}

	public onMoreRows(eventMessage: sqlops.ProfilerSessionEvents) {
		for (let i: number  = 0; i < eventMessage.events.length && i < 500; ++i) {
			let e: sqlops.ProfilerEvent = eventMessage.events[i];
			let data = {};
			data['EventClass'] =  e.name;
			data['StartTime'] = e.timestamp;
			data['EndTime'] = e.timestamp;
			const columns = [
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

			let columnNameMap: Map<string, string> = new Map<string, string>();
			columnNameMap['client_app_name'] = 'ApplicationName';
			columnNameMap['nt_username'] = 'NTUserName';
			columnNameMap['options_text'] = 'TextData';
			columnNameMap['server_principal_name'] = 'LoginName';
			columnNameMap['session_id'] = 'SPID';
			columnNameMap['batch_text'] = 'TextData';
			columnNameMap['cpu_time'] = 'CPU';
			columnNameMap['duration'] = 'Duration';
			columnNameMap['logical_reads'] = 'Reads';

			for (let idx = 0; idx < columns.length; ++idx) {
				let columnName = columns[idx];
				data[columnName] = '';
			}

			for (let key in e.values) {
				let columnName = columnNameMap[key];
				if (columnName) {
					let value = e.values[key];
					data[columnName] = value;
				}
			}
			this._data.push(data);
		}

	}
}
