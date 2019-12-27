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
import { UntitledTextEditorInput } from 'vs/workbench/common/editor/untitledTextEditorInput';
import { ILanguageAssociation } from 'sql/workbench/common/languageAssociation';
import { QueryEditorInput } from 'sql/workbench/contrib/query/common/queryEditorInput';

const editorInputFactoryRegistry = Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories);

export class QueryEditorLanguageAssociation implements ILanguageAssociation {
	readonly isDefault = true;
	readonly languages = ['sql'];

	constructor(@IInstantiationService private readonly instantiationService: IInstantiationService) { }

	convertInput(activeEditor: IEditorInput): QueryEditorInput {
		const queryResultsInput = this.instantiationService.createInstance(QueryResultsInput, activeEditor.getResource().toString(true));
		if (activeEditor instanceof FileEditorInput) {
			return this.instantiationService.createInstance(FileQueryEditorInput, '', activeEditor, queryResultsInput);
		} else if (activeEditor instanceof UntitledTextEditorInput) {
			return this.instantiationService.createInstance(UntitledQueryEditorInput, '', activeEditor, queryResultsInput);
		} else {
			return undefined;
		}
	}

	createBase(activeEditor: QueryEditorInput): IEditorInput {
		return activeEditor.text;
	}
}

export class FileQueryEditorInputFactory implements IEditorInputFactory {
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
		const queryResultsInput = instantiationService.createInstance(QueryResultsInput, fileEditorInput.getResource().toString());
		return instantiationService.createInstance(FileQueryEditorInput, '', fileEditorInput, queryResultsInput);
	}

	canSerialize(): boolean { // we can always serialize query inputs
		return true;
	}
}

export class UntitledQueryEditorInputFactory implements IEditorInputFactory {
	serialize(editorInput: UntitledQueryEditorInput): string {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(UntitledTextEditorInput.ID);
		if (factory) {
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
