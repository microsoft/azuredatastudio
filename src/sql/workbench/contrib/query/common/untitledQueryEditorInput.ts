/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditorInput } from 'sql/workbench/contrib/query/common/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/contrib/query/common/queryResultsInput';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';

import { IEncodingSupport, EncodingMode } from 'vs/workbench/common/editor';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { UntitledEditorModel } from 'vs/workbench/common/editor/untitledEditorModel';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { IFileService } from 'vs/platform/files/common/files';

type PublicPart<T> = { [K in keyof T]: T[K] };

export class UntitledQueryEditorInput extends QueryEditorInput implements IEncodingSupport, PublicPart<UntitledEditorInput> {

	public static readonly ID = 'workbench.editorInput.untitledQueryInput';

	public readonly onDidModelChangeContent = this.text.onDidModelChangeContent;
	public readonly onDidModelChangeEncoding = this.text.onDidModelChangeEncoding;

	constructor(
		description: string,
		text: UntitledEditorInput,
		results: QueryResultsInput,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IConfigurationService configurationService: IConfigurationService,
		@IFileService fileService: IFileService
	) {
		super(description, text, results, connectionManagementService, queryModelService, configurationService, fileService);
	}

	public resolve(): Promise<UntitledEditorModel & IResolvedTextEditorModel> {
		return this.text.resolve();
	}

	public get text(): UntitledEditorInput {
		return this._text as UntitledEditorInput;
	}

	public get hasAssociatedFilePath(): boolean {
		return this.text.hasAssociatedFilePath;
	}

	public suggestFileName(): string {
		return this.text.suggestFileName();
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

	hasBackup(): boolean {
		if (this.text) {
			return this.text.hasBackup();
		}

		return false;
	}
}
