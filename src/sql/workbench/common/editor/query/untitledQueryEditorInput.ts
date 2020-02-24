/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';

import { IEncodingSupport, EncodingMode } from 'vs/workbench/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { IConnection } from 'sql/platform/connection/common/connectionService';
import { IConnectionDialogService } from 'sql/workbench/services/connection/common/connectionDialogService';
import { IQueryService } from 'sql/platform/query/common/queryService';

export class UntitledQueryEditorInput extends QueryEditorInput implements IEncodingSupport {

	public static readonly ID = 'workbench.editorInput.untitledQueryInput';

	constructor(
		description: string,
		text: UntitledTextEditorInput,
		results: QueryResultsInput,
		initialConnection: IConnection | undefined,
		@IConfigurationService configurationService: IConfigurationService,
		@IConnectionDialogService connectionDialogService: IConnectionDialogService,
		@IQueryService queryService: IQueryService
	) {
		super(description, text, results, initialConnection, configurationService, connectionDialogService, queryService);
	}

	public resolve(): Promise<IUntitledTextEditorModel & IResolvedTextEditorModel> {
		return this.text.resolve();
	}

	public get text(): UntitledTextEditorInput {
		return this._text as UntitledTextEditorInput;
	}

	public get hasAssociatedFilePath(): boolean {
		return this.text.model.hasAssociatedFilePath;
	}

	public setMode(mode: string): void {
		this.text.setMode(mode);
	}

	public getMode(): string | undefined {
		return this.text.getMode();
	}

	public getTypeId(): string {
		return UntitledQueryEditorInput.ID;
	}

	public getEncoding(): string | undefined {
		return this.text.getEncoding();
	}

	public setEncoding(encoding: string, mode: EncodingMode): void {
		this.text.setEncoding(encoding, mode);
	}

	isUntitled(): boolean {
		// Subclasses need to explicitly opt-in to being untitled.
		return true;
	}
}
