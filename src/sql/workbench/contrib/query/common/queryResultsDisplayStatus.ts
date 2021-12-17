/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';

export enum QueryResultsDisplayMode {
	ResultsToGrid,
	ResultsToFile,
}

export class QueryResultsDisplayStatus extends Disposable {
	public static instance: QueryResultsDisplayStatus = undefined;

	private displayMode: QueryResultsDisplayMode;

	private readonly _onStatusChanged = this._register(new Emitter<void>());
	public readonly onStatusChanged: Event<void> = this._onStatusChanged.event;

	public static getInstance() {
		if (this.instance === undefined) {
			this.instance = new QueryResultsDisplayStatus();
		}

		return this.instance;
	}

	private constructor(resultsRenderMode: QueryResultsDisplayMode = QueryResultsDisplayMode.ResultsToGrid) {
		super();
		this.displayMode = resultsRenderMode;
	}

	public set mode(resultsRenderMode: QueryResultsDisplayMode) {
		this.displayMode = resultsRenderMode;
		this._onStatusChanged.fire();
	}

	public get mode() {
		return this.displayMode;
	}
}
