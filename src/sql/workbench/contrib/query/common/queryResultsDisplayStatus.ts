/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';
import { Emitter, Event } from 'vs/base/common/event';

export enum QueryResultsWriterMode {
	ToGrid,
	ToFile,
}

export class QueryResultsWriterStatus extends Disposable {
	public static instance: QueryResultsWriterStatus = undefined;

	private writerMode: QueryResultsWriterMode;

	private readonly _onStatusChanged = this._register(new Emitter<void>());
	public readonly onStatusChanged: Event<void> = this._onStatusChanged.event;

	public static getInstance(): QueryResultsWriterStatus {
		if (this.instance === undefined) {
			this.instance = new QueryResultsWriterStatus();
		}

		return this.instance;
	}

	private constructor(mode: QueryResultsWriterMode = QueryResultsWriterMode.ToGrid) {
		super();
		this.writerMode = mode;
	}

	public set mode(mode: QueryResultsWriterMode) {
		this.writerMode = mode;
		this._onStatusChanged.fire();
	}

	public get mode() {
		return this.writerMode;
	}

	public isWritingToGrid(): boolean {
		return this.writerMode === QueryResultsWriterMode.ToGrid;
	}
}
