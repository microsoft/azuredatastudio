/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { QueryResultsInput } from 'sql/workbench/common/editor/query/queryResultsInput';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';

import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IResolvedTextEditorModel } from 'vs/editor/common/services/resolverService';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { IUntitledTextEditorModel } from 'vs/workbench/services/untitled/common/untitledTextEditorModel';
import { EncodingMode } from 'vs/workbench/services/textfile/common/textfiles';
import { GroupIdentifier, ISaveOptions, IEditorInput, EditorInputCapabilities } from 'vs/workbench/common/editor';
import { FileQueryEditorInput } from 'sql/workbench/contrib/query/browser/fileQueryEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { UNTITLED_QUERY_EDITOR_TYPEID } from 'sql/workbench/common/constants';
import { IUntitledQueryEditorInput } from 'sql/base/query/common/untitledQueryEditorInput';

export class UntitledQueryEditorInput extends QueryEditorInput implements IUntitledQueryEditorInput {

	public static readonly ID = UNTITLED_QUERY_EDITOR_TYPEID;

	constructor(
		description: string | undefined,
		text: UntitledTextEditorInput,
		results: QueryResultsInput,
		@IConnectionManagementService connectionManagementService: IConnectionManagementService,
		@IQueryModelService queryModelService: IQueryModelService,
		@IConfigurationService configurationService: IConfigurationService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super(description, text, results, connectionManagementService, queryModelService, configurationService, instantiationService);
	}

	public override resolve(): Promise<IUntitledTextEditorModel & IResolvedTextEditorModel> {
		return this.text.resolve();
	}

	public override get text(): UntitledTextEditorInput {
		return this._text as UntitledTextEditorInput;
	}

	public get hasAssociatedFilePath(): boolean {
		return this.text.model.hasAssociatedFilePath;
	}

	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		let fileEditorInput = await this.text.save(group, options);
		return this.createFileQueryEditorInput(fileEditorInput);
	}

	override async saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IEditorInput | undefined> {
		let fileEditorInput = await this.text.saveAs(group, options);
		return this.createFileQueryEditorInput(fileEditorInput);
	}

	private async createFileQueryEditorInput(fileEditorInput: IEditorInput): Promise<IEditorInput> {
		// Create our own FileQueryEditorInput wrapper here so that the existing state (connection, results, etc) can be transferred from this input to the new file input.
		try {
			let newUri = fileEditorInput.resource.toString(true);
			await this.changeConnectionUri(newUri);
			this._results.uri = newUri;
			let newInput = this.instantiationService.createInstance(FileQueryEditorInput, '', (fileEditorInput as FileEditorInput), this.results);
			newInput.state.setState(this.state);
			return newInput;
		}
		catch (error) {
			/**
			 * We are saving over a file that is already open and connected, return the unaltered save editor input directly (to avoid side effects when changing connection).
			 * This will replace the editor input in the already open window with that of the new one,
			 * the connection will be undefined and the file appears to be disconnected even if its not, you can change the connection to fix this.
			 * also the results shown will be the old results, until you press run again.
			 */
			return fileEditorInput;
		}
	}

	public setMode(mode: string): void {
		this.text.setMode(mode);
	}

	public getMode(): string | undefined {
		return this.text.getMode();
	}

	override get typeId(): string {
		return UntitledQueryEditorInput.ID;
	}

	public getEncoding(): string | undefined {
		return this.text.getEncoding();
	}

	public setEncoding(encoding: string, mode: EncodingMode): Promise<void> {
		return this.text.setEncoding(encoding, mode);
	}

	override get capabilities(): EditorInputCapabilities {
		// Subclasses need to explicitly opt-in to being untitled.
		return EditorInputCapabilities.Untitled;
	}
}
