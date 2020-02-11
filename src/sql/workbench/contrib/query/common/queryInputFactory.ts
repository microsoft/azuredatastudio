/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorInputFactory, IEditorInputFactoryRegistry, Extensions as EditorInputExtensions, IEditorInput } from 'vs/workbench/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { QueryResultsInput } from 'sql/workbench/contrib/query/common/queryResultsInput';
import { FILE_EDITOR_INPUT_ID } from 'vs/workbench/contrib/files/common/files';
import { UntitledQueryEditorInput } from 'sql/workbench/contrib/query/common/untitledQueryEditorInput';
import { FileQueryEditorInput } from 'sql/workbench/contrib/query/common/fileQueryEditorInput';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { ILanguageAssociation } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { QueryEditorInput } from 'sql/workbench/contrib/query/common/queryEditorInput';
import { getCurrentGlobalConnection } from 'sql/workbench/browser/taskUtilities';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { IConnectionManagementService, IConnectionCompletionOptions, ConnectionType } from 'sql/platform/connection/common/connectionManagement';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { onUnexpectedError } from 'vs/base/common/errors';
import { IFileService } from 'vs/platform/files/common/files';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

const editorInputFactoryRegistry = Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories);

export class QueryEditorLanguageAssociation implements ILanguageAssociation {
	static readonly isDefault = true;
	static readonly languages = ['sql'];

	constructor(@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IObjectExplorerService private readonly objectExplorerService: IObjectExplorerService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IEditorService private readonly editorService: IEditorService) { }

	convertInput(activeEditor: IEditorInput): QueryEditorInput | undefined {
		const queryResultsInput = this.instantiationService.createInstance(QueryResultsInput, activeEditor.getResource().toString(true));
		let queryEditorInput: QueryEditorInput;
		if (activeEditor instanceof FileEditorInput) {
			queryEditorInput = this.instantiationService.createInstance(FileQueryEditorInput, '', activeEditor, queryResultsInput);
		} else if (activeEditor instanceof UntitledTextEditorInput) {
			queryEditorInput = this.instantiationService.createInstance(UntitledQueryEditorInput, '', activeEditor, queryResultsInput);
		} else {
			return undefined;
		}

		const profile = getCurrentGlobalConnection(this.objectExplorerService, this.connectionManagementService, this.editorService);
		if (profile) {
			const options: IConnectionCompletionOptions = {
				params: { connectionType: ConnectionType.editor, runQueryOnCompletion: undefined, input: queryEditorInput },
				saveTheConnection: false,
				showDashboard: false,
				showConnectionDialogOnError: true,
				showFirewallRuleOnError: true
			};
			this.connectionManagementService.connect(profile, queryEditorInput.uri, options).catch(err => onUnexpectedError(err));
		}

		return queryEditorInput;
	}

	createBase(activeEditor: QueryEditorInput): IEditorInput {
		return activeEditor.text;
	}
}

export class FileQueryEditorInputFactory implements IEditorInputFactory {

	constructor(@IFileService private readonly fileService: IFileService) {

	}
	serialize(editorInput: FileQueryEditorInput): string {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(FILE_EDITOR_INPUT_ID);
		if (factory) {
			return factory.serialize(editorInput.text); // serialize based on the underlying input
		}
		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): FileQueryEditorInput | undefined {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(FILE_EDITOR_INPUT_ID);
		const fileEditorInput = factory.deserialize(instantiationService, serializedEditorInput) as FileEditorInput;
		// only successfully deserilize the file if the resource actually exists
		if (this.fileService.exists(fileEditorInput.getResource())) {
			const queryResultsInput = instantiationService.createInstance(QueryResultsInput, fileEditorInput.getResource().toString());
			return instantiationService.createInstance(FileQueryEditorInput, '', fileEditorInput, queryResultsInput);
		} else {
			fileEditorInput.dispose();
			return undefined;
		}
	}

	canSerialize(): boolean { // we can always serialize query inputs
		return true;
	}
}

export class UntitledQueryEditorInputFactory implements IEditorInputFactory {

	constructor(@IConfigurationService private readonly configurationService: IConfigurationService) { }
	serialize(editorInput: UntitledQueryEditorInput): string {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(UntitledTextEditorInput.ID);
		// only serialize non-dirty files if the user has that setting
		if (factory && (editorInput.isDirty() || this.configurationService.getValue<boolean>('sql.promptToSaveGeneratedFiles'))) {
			return factory.serialize(editorInput.text); // serialize based on the underlying input
		}
		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): UntitledQueryEditorInput | undefined {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(UntitledTextEditorInput.ID);
		const untitledEditorInput = factory.deserialize(instantiationService, serializedEditorInput) as UntitledTextEditorInput;
		const queryResultsInput = instantiationService.createInstance(QueryResultsInput, untitledEditorInput.getResource().toString());
		return instantiationService.createInstance(UntitledQueryEditorInput, '', untitledEditorInput, queryResultsInput);
	}

	canSerialize(): boolean { // we can always serialize query inputs
		return true;
	}
}
