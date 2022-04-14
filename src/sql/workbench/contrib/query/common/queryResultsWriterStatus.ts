/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { Disposable } from 'vs/base/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

export enum QueryResultsWriterMode {
	ToGrid,
	ToFile,
}

export class QueryResultsWriterStatus extends Disposable {
	private writerMode: QueryResultsWriterMode;

	constructor(mode: QueryResultsWriterMode | undefined,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super();

		if (mode === undefined) {
			let writeQueryResultsToFile = configurationService.getValue<IQueryEditorConfiguration>('queryEditor').writeQueryResultsToFile;
			mode = writeQueryResultsToFile ? QueryResultsWriterMode.ToFile : QueryResultsWriterMode.ToGrid;
		}

		this.writerMode = mode;
	}

	public set mode(mode: QueryResultsWriterMode) {
		this.writerMode = mode;
	}

	public get mode() {
		return this.writerMode;
	}
}
