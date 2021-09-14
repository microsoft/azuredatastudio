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
		let newEditorInput = await this.text.saveAs(group, options);
		let newUri = newEditorInput.resource.toString(true);
		if (newUri === this.uri) {
			// URI is the same location, no need to change URI for the query in services, just return input.
			return newEditorInput;
		}
		else {
			// URI is different, need to update URI for the query in services to ensure we can keep the current results/view state
			// without resetting and creating a brand new query.
			try {
				await this.changeConnectionUri(newUri);
				this._results.uri = newUri;
				// Create a new FileQueryEditorInput with current results and state in order to trigger a rename for editor tab name.
				// (Tab name won't refresh automatically if current input is reused directly)
				let newFileQueryInput = this.instantiationService.createInstance(FileQueryEditorInput, '', (newEditorInput as FileEditorInput), this.results);
				newFileQueryInput.state.setState(this.state);
				return newFileQueryInput;
			}
			catch (error) {
				/**
				 * We are saving over a file that is already open and connected, return the unaltered save editor input directly (to avoid side effects when changing connection).
				 * This will replace the editor input in the already open window with that of the new one,
				 * the connection will be undefined and the file appears to be disconnected even if its not, change the connection to fix this.
				 * also the results shown will be the old results, until run is clicked again.
				 */
				return newEditorInput;
			}
		}
	}
}
