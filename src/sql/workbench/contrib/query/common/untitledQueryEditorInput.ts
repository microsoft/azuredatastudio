/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditorInput } from 'sql/workbench/contrib/query/common/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/contrib/query/common/queryResultsInput';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';

import { IEncodingSupport, EncodingMode } from 'vs/workbench/common/editor';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';
import { UntitledTextEditorModel } from 'vs/workbench/common/editor/untitledTextEditorModel';

type PublicPart<T> = { [K in keyof T]: T[K] };

export class UntitledQueryEditorInput extends QueryEditorInput implements IEncodingSupport, PublicPart<UntitledTextEditorInput> {

	public static readonly ID = 'workbench.editorInput.untitledQueryInput';

	public readonly onDidModelChangeEncoding = this.text.onDidModelChangeEncoding;

	constructor(
		description: string,
		text: UntitledTextEditorInput,
		results: QueryResultsInput,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(description, text, results, connectionManagementService, queryModelService, configurationService);
	}

	public resolve(): Promise<UntitledTextEditorModel & IResolvedTextEditorModel> {
		return this.text.resolve();
	}

	public get text(): UntitledTextEditorInput {
		return this._text as UntitledTextEditorInput;
	}

	public get hasAssociatedFilePath(): boolean {
		return this.text.hasAssociatedFilePath;
	}

	public setMode(mode: string): void {
		this.text.setMode(mode);
	}

	public getMode(): string {
		return this.text.getMode();
	}

	public getTypeId(): string {
		return UntitledQueryEditorInput.ID;
	}

	public getEncoding(): string {
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
