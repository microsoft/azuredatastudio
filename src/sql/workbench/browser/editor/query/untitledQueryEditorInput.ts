/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
import { GroupIdentifier, ISaveOptions, EditorInputCapabilities, IUntypedEditorInput, DEFAULT_EDITOR_ASSOCIATION, isEditorInputWithOptionsAndGroup } from 'vs/workbench/common/editor';
import { FileQueryEditorInput } from 'sql/workbench/browser/editor/query/fileQueryEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileEditorInput } from 'vs/workbench/contrib/files/browser/editors/fileEditorInput';
import { UNTITLED_QUERY_EDITOR_TYPEID } from 'sql/workbench/common/constants';
import { IUntitledQueryEditorInput } from 'sql/workbench/common/editor/query/untitledQueryEditorInput';
import { IEditorResolverService } from 'vs/workbench/services/editor/common/editorResolverService';
import { Uri } from 'vscode';
import { ILogService } from 'vs/platform/log/common/log';
import { IServerContextualizationService } from 'sql/workbench/services/contextualization/common/interfaces';

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
		@ILogService private readonly logService: ILogService,
		@IEditorResolverService private readonly editorResolverService: IEditorResolverService,
		@IServerContextualizationService serverContextualizationService: IServerContextualizationService
	) {
		super(description, text, results, connectionManagementService, queryModelService, configurationService, instantiationService, serverContextualizationService);
		// Set the mode explicitely to stop the auto language detection service from changing the mode unexpectedly.
		// the auto language detection service won't do the language change only if the mode is explicitely set.
		// if the mode (e.g. kusto, sql) do not exist for whatever reason, we will default it to sql.
		text.setLanguageId(text.getLanguageId() ?? 'sql');
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

	override async save(group: GroupIdentifier, options?: ISaveOptions): Promise<IUntypedEditorInput | undefined> {
		let fileEditorInput = await this.text.save(group, options);
		return this.createFileQueryEditorInput(fileEditorInput, group);
	}

	override async saveAs(group: GroupIdentifier, options?: ISaveOptions): Promise<IUntypedEditorInput | undefined> {
		let fileEditorInput = await this.text.saveAs(group, options);
		return this.createFileQueryEditorInput(fileEditorInput, group);
	}

	private async createFileQueryEditorInput(untypedEditor: IUntypedEditorInput, group: GroupIdentifier): Promise<IUntypedEditorInput> {
		// Create our own FileQueryEditorInput wrapper here so that the existing state (connection, results, etc) can be transferred from this input to the new file input.
		try {
			let newUri: Uri = (<any>untypedEditor).resource;
			let newUriString = newUri.toString(true);
			await this.changeConnectionUri(newUriString);

			// create a FileQueryEditorInput from the untyped editor input
			this._results.uri = newUriString;
			const editor = await this.editorResolverService.resolveEditor({ resource: (<any>untypedEditor).resource, options: { override: DEFAULT_EDITOR_ASSOCIATION.id } }, group);
			if (isEditorInputWithOptionsAndGroup(editor)) {
				let newInput = this.instantiationService.createInstance(FileQueryEditorInput, '', <FileEditorInput>(editor.editor), this.results);
				newInput.state.setState(this.state);
				return newInput;
			} else {
				throw new Error(`Could not resolved editor for resource '${newUriString}'`);
			}
		}
		catch (error) {
			/**
			 * We are saving over a file that is already open and connected, return the unaltered save editor input directly (to avoid side effects when changing connection).
			 * This will replace the editor input in the already open window with that of the new one,
			 * the connection will be undefined and the file appears to be disconnected even if its not, change the connection to fix this.
			 * also the results shown will be the old results, until run is clicked again.
			 */
			this.logService.warn(error.message);
			return untypedEditor;
		}
	}

	public setMode(mode: string): void {
		this.text.setLanguageId(mode);
	}

	public getMode(): string | undefined {
		return this.text.getLanguageId();
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
