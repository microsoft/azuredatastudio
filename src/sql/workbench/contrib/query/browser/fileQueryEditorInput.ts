/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';

import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IMoveResult, GroupIdentifier, ISaveOptions, IEditorInput } from 'vs/workbench/common/editor';
import { BinaryEditorModel } from 'vs/workbench/common/editor/binaryEditorModel';
import { EncodingMode, ITextFileEditorModel } from 'vs/workbench/services/textfile/common/textfiles';
import { URI } from 'vs/base/common/uri';
import { FILE_QUERY_EDITOR_TYPEID } from 'sql/workbench/common/constants';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class FileQueryEditorInput extends QueryEditorInput {

	public static readonly ID = FILE_QUERY_EDITOR_TYPEID;

	constructor(
		description: string,
		text: FileEditorInput,
		results: QueryResultsInput,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService
	) {
		super(description, text, results, connectionManagementService, queryModelService, configurationService, instantiationService);
	}

	public override resolve(): Promise<ITextFileEditorModel | BinaryEditorModel> {
		return this.text.resolve();
	}

	public override get text(): FileEditorInput {
		return this._text as FileEditorInput;
	}

	override get typeId(): string {
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

	public override rename(group: GroupIdentifier, target: URI): IMoveResult {
		return this.text.rename(group, target);
	}

	override async saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		// Create our own FileQueryEditorInput wrapper here so that the existing state (connection, results, etc) can be transferred from this input to the new input.
		let newEditorInput = await this.text.saveAs(group, options);
		let newUri = newEditorInput.resource.toString(true);
		if (newUri === this.uri) {
			return newEditorInput;
		}
		else {
			this._results.uri = newUri;
			await this.changeConnectionUri(newUri);
			this._text = newEditorInput as FileEditorInput;
			return this;
		}
	}
}
