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

class QueryResultsDisplayStatus extends Disposable {
	private displayMode: QueryResultsDisplayMode;

	private readonly _onStatusChanged = this._register(new Emitter<void>());
	public readonly onStatusChanged: Event<void> = this._onStatusChanged.event;

	constructor(resultsRenderMode: QueryResultsDisplayMode = QueryResultsDisplayMode.ResultsToGrid) {
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

const ResultsDisplayStatus = new QueryResultsDisplayStatus();
export default ResultsDisplayStatus;
