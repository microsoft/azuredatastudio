/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';

export enum QueryResultsWriterMode {
	ToGrid,
	ToFile,
}

export class QueryResultsWriterStatus extends Disposable {
	public static instance: QueryResultsWriterStatus = undefined;

	private writerMode: QueryResultsWriterMode;

	constructor(mode: QueryResultsWriterMode = QueryResultsWriterMode.ToGrid) {
		super();
		this.writerMode = mode;
	}

	public set mode(mode: QueryResultsWriterMode) {
		this.writerMode = mode;
	}

	public get mode() {
		return this.writerMode;
	}

	public isWritingToGrid(): boolean {
		return this.writerMode === QueryResultsWriterMode.ToGrid;
	}

	public isWritingToFIle(): boolean {
		return this.writerMode === QueryResultsWriterMode.ToFile;
	}
}
