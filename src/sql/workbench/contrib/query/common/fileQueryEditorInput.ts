/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';

import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { EncodingMode, IMoveResult, GroupIdentifier } from 'vs/workbench/common/editor';
import { BinaryEditorModel } from 'vs/workbench/common/editor/binaryEditorModel';
import { ITextFileEditorModel } from 'vs/workbench/services/textfile/common/textfiles';
import { URI } from 'vs/base/common/uri';

export class FileQueryEditorInput extends QueryEditorInput {

	public static readonly ID = 'workbench.editorInput.fileQueryInput';

	constructor(
		description: string,
		text: FileEditorInput,
		results: QueryResultsInput,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(description, text, results, connectionManagementService, queryModelService, configurationService);
	}

	public resolve(): Promise<ITextFileEditorModel | BinaryEditorModel> {
		return this.text.resolve();
	}

	public get text(): FileEditorInput {
		return this._text as FileEditorInput;
	}

	public getTypeId(): string {
		return FileQueryEditorInput.ID;
	}

	public getEncoding(): string {
		return this.text.getEncoding();
	}

	public setEncoding(encoding: string, mode: EncodingMode) {
		this.text.setEncoding(encoding, mode);
	}

	public getPreferredEncoding(): string {
		return this.text.getPreferredEncoding();
	}

	public setPreferredEncoding(encoding: string) {
		this.text.setPreferredEncoding(encoding);
	}

	public getPreferredMode(): string {
		return this.text.getPreferredMode();
	}

	public setMode(mode: string) {
		this.text.setMode(mode);
	}

	public setPreferredMode(mode: string) {
		this.text.setPreferredMode(mode);
	}

	public setForceOpenAsText() {
		this.text.setForceOpenAsText();
	}

	public setForceOpenAsBinary() {
		this.text.setForceOpenAsBinary();
	}

	public isResolved(): boolean {
		return this.text.isResolved();
	}

	public rename(group: GroupIdentifier, target: URI): IMoveResult {
		return this.text.rename(group, target);
	}
}
