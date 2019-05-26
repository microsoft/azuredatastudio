/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorInputFactory, IEditorInputFactoryRegistry, Extensions as EditorInputExtensions } from 'vs/workbench/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { QueryResultsInput } from 'sql/workbench/parts/query/common/queryResultsInput';
import { FILE_EDITOR_INPUT_ID } from 'vs/workbench/contrib/files/common/files';
import { UntitledQueryEditorInput } from 'sql/workbench/parts/query/common/untitledQueryEditorInput';
import { FileQueryEditorInput } from 'sql/workbench/parts/query/common/fileQueryEditorInput';

const editorInputFactoryRegistry = Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories);

export class FileQueryEditorInputFactory implements IEditorInputFactory {
	serialize(editorInput: FileQueryEditorInput): string {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(editorInput.text.getTypeId());
		if (factory) {
			return factory.serialize(editorInput); // serialize based on the underlying input
		}
		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): FileQueryEditorInput | undefined {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(FILE_EDITOR_INPUT_ID);
		const fileEditorInput = factory.deserialize(instantiationService, serializedEditorInput);
		const queryResultsInput = instantiationService.createInstance(QueryResultsInput, fileEditorInput.getResource().toString());
		return instantiationService.createInstance(FileQueryEditorInput, '', <any>fileEditorInput, queryResultsInput, undefined);
	}
}

export class UntitledQueryEditorInputFactory implements IEditorInputFactory {
	serialize(editorInput: UntitledQueryEditorInput): string {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(UntitledEditorInput.ID);
		if (factory) {
			return factory.serialize(editorInput); // serialize based on the underlying input
		}
		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): UntitledQueryEditorInput | undefined {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(UntitledEditorInput.ID);
		const untitledEditorInput = factory.deserialize(instantiationService, serializedEditorInput);
		const queryResultsInput = instantiationService.createInstance(QueryResultsInput, untitledEditorInput.getResource().toString());
		return instantiationService.createInstance(UntitledQueryEditorInput, '', <any>untitledEditorInput, queryResultsInput, undefined);
	}
}
