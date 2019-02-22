/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput, IEditorInput } from 'vs/workbench/common/editor';
import { IInstantiationService, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import { UntitledEditorInput } from 'vs/workbench/common/editor/untitledEditorInput';
import { FileEditorInput } from 'vs/workbench/parts/files/common/editors/fileEditorInput';
import { URI } from 'vs/base/common/uri';

import { QueryResultsInput } from 'sql/parts/query/common/queryResultsInput';
import { QueryInput } from 'sql/parts/query/common/queryInput';
import { IQueryEditorOptions } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { QueryPlanInput } from 'sql/parts/queryPlan/queryPlanInput';
import { NotebookInput, NotebookInputModel } from 'sql/parts/notebook/notebookInput';
import { DEFAULT_NOTEBOOK_PROVIDER, INotebookService } from 'sql/workbench/services/notebook/common/notebookService';
import { getProvidersForFileName, getStandardKernelsForProvider } from 'sql/parts/notebook/notebookUtils';
import { ResourceEditorInput } from 'vs/workbench/common/editor/resourceEditorInput';

const fs = require('fs');

////// Exported public functions/vars

// prefix for untitled sql editors
export const untitledFilePrefix = 'SQLQuery';

// mode identifier for SQL mode
export const sqlModeId = 'sql';
export const notebookModeId = 'notebook';

/**
 * Checks if the specified input is supported by one our custom input types, and if so convert it
 * to that type.
 * @param input The input to check for conversion
 * @param options Editor options for controlling the conversion
 * @param instantiationService The instantiation service to use to create the new input types
 */
export function convertEditorInput(input: EditorInput, options: IQueryEditorOptions, instantiationService: IInstantiationService): EditorInput {
	let denyQueryEditor = options && options.denyQueryEditor;
	if (input && !denyQueryEditor) {
		//QueryInput
		let uri: URI = getQueryEditorFileUri(input);
		if (uri) {
			const queryResultsInput: QueryResultsInput = instantiationService.createInstance(QueryResultsInput, uri.toString());
			let queryInput: QueryInput = instantiationService.createInstance(QueryInput, '', input, queryResultsInput, undefined);
			return queryInput;
		}

		//QueryPlanInput
		uri = getQueryPlanEditorUri(input);
		if (uri) {
			let queryPlanXml: string = fs.readFileSync(uri.fsPath);
			let queryPlanInput: QueryPlanInput = instantiationService.createInstance(QueryPlanInput, queryPlanXml, 'aaa', undefined);
			return queryPlanInput;
		}

		//Notebook
		uri = getNotebookEditorUri(input, instantiationService);
		if (uri) {
			return withService<INotebookService, NotebookInput>(instantiationService, INotebookService, notebookService => {
				let fileName: string = 'untitled';
				let providerIds: string[] = [DEFAULT_NOTEBOOK_PROVIDER];
				if (input) {
					fileName = input.getName();
					providerIds = getProvidersForFileName(fileName, notebookService);
				}
				let notebookInputModel = new NotebookInputModel(uri, undefined, false, undefined);
				notebookInputModel.providerId = providerIds.filter(provider => provider !== DEFAULT_NOTEBOOK_PROVIDER)[0];
				notebookInputModel.providers = providerIds;
				notebookInputModel.providers.forEach(provider => {
					let standardKernels = getStandardKernelsForProvider(provider, notebookService);
					notebookInputModel.standardKernels = standardKernels;
				});
				let notebookInput: NotebookInput = instantiationService.createInstance(NotebookInput, fileName, notebookInputModel);
				return notebookInput;
			});
		}
	}
	return input;
}

/**
 * Gets the resource of the input if it's one of the ones we support.
 * @param input The IEditorInput to get the resource of
 */
export function getSupportedInputResource(input: IEditorInput): URI {
	if (input instanceof UntitledEditorInput) {
		let untitledCast: UntitledEditorInput = <UntitledEditorInput>input;
		if (untitledCast) {
			return untitledCast.getResource();
		}
	}

	if (input instanceof FileEditorInput) {
		let fileCast: FileEditorInput = <FileEditorInput>input;
		if (fileCast) {
			return fileCast.getResource();
		}
	}

	if (input instanceof ResourceEditorInput) {
		let resourceCast: ResourceEditorInput = <ResourceEditorInput>input;
		if (resourceCast) {
			return resourceCast.getResource();
		}
	}

	return undefined;
}

////// Non-Exported Private functions/vars

// file extensions for the inputs we support (should be all upper case for comparison)
const sqlFileTypes = ['SQL'];
const sqlPlanFileTypes = ['SQLPLAN'];

/**
 * If input is a supported query editor file, return it's URI. Otherwise return undefined.
 * @param input The EditorInput to retrieve the URI of
 */
function getQueryEditorFileUri(input: EditorInput): URI {
	if (!input || !input.getName()) {
		return undefined;
	}

	// If this editor is not already of type queryinput
	if (!(input instanceof QueryInput)) {

		// If this editor has a URI
		let uri: URI = getSupportedInputResource(input);
		if (uri) {
			let isValidUri: boolean = !!uri && !!uri.toString;

			if (isValidUri && (hasFileExtension(sqlFileTypes, input, true) || hasSqlFileMode(input))) {
				return uri;
			}
		}
	}

	return undefined;
}

/**
 * If input is a supported query plan editor file (.sqlplan), return it's URI. Otherwise return undefined.
 * @param input The EditorInput to get the URI of
 */
function getQueryPlanEditorUri(input: EditorInput): URI {
	if (!input || !input.getName()) {
		return undefined;
	}

	// If this editor is not already of type queryinput
	if (!(input instanceof QueryPlanInput)) {
		let uri: URI = getSupportedInputResource(input);
		if (uri) {
			if (hasFileExtension(sqlPlanFileTypes, input, false)) {
				return uri;
			}
		}
	}

	return undefined;
}

/**
 * If input is a supported notebook editor file (.ipynb), return it's URI. Otherwise return undefined.
 * @param input The EditorInput to get the URI of.
 */
function getNotebookEditorUri(input: EditorInput, instantiationService: IInstantiationService): URI {
	if (!input || !input.getName()) {
		return undefined;
	}

	// If this editor is not already of type notebook input
	if (!(input instanceof NotebookInput)) {
		let uri: URI = getSupportedInputResource(input);
		if (uri) {
			if (hasFileExtension(getNotebookFileExtensions(instantiationService), input, false) || hasNotebookFileMode(input)) {
				return uri;
			}
		}
	}
	return undefined;
}

function getNotebookFileExtensions(instantiationService: IInstantiationService): string[] {
	return withService<INotebookService, string[]>(instantiationService, INotebookService, notebookService => {
		return notebookService.getSupportedFileExtensions();
	});
}

/**
 * Checks whether the given EditorInput is set to either undefined or notebook mode
 * @param input The EditorInput to check the mode of
 */
function hasNotebookFileMode(input: EditorInput): boolean {
	if (input instanceof UntitledEditorInput) {
		let untitledCast: UntitledEditorInput = <UntitledEditorInput>input;
		return (untitledCast && untitledCast.getModeId() === notebookModeId);
	}
	return false;
}

function withService<TService, TResult>(instantiationService: IInstantiationService, serviceId: ServiceIdentifier<TService>, action: (service: TService) => TResult, ): TResult {
	return instantiationService.invokeFunction(accessor => {
		let service = accessor.get(serviceId);
		return action(service);
	});
}

/**
 * Checks whether the given EditorInput is set to either undefined or sql mode
 * @param input The EditorInput to check the mode of
 */
function hasSqlFileMode(input: EditorInput): boolean {
	if (input instanceof UntitledEditorInput) {
		let untitledCast: UntitledEditorInput = <UntitledEditorInput>input;
		return untitledCast && (untitledCast.getModeId() === undefined || untitledCast.getModeId() === sqlModeId);
	}

	return false;
}

/**
 * Checks whether the name of the specified input has an extension that is
 * @param extensions The extensions to check for
 * @param input The input to check for the specified extensions
 */
function hasFileExtension(extensions: string[], input: EditorInput, checkUntitledFileType: boolean): boolean {
	// Check the extension type
	let lastPeriodIndex = input.getName().lastIndexOf('.');
	if (lastPeriodIndex > -1) {
		let extension: string = input.getName().substr(lastPeriodIndex + 1).toUpperCase();
		return !!extensions.find(x => x === extension);
	}

	// Check for untitled file type
	if (checkUntitledFileType && input.getName().includes(untitledFilePrefix)) {
		return true;
	}

	// Return false if not a queryEditor file
	return false;
}

// Returns file mode - notebookModeId or sqlModeId
export function getFileMode(instantiationService: IInstantiationService, resource: URI): string {
	if (!resource) {
		return sqlModeId;
	}
	return withService<INotebookService, string>(instantiationService, INotebookService, notebookService => {
		for (const editor of notebookService.listNotebookEditors()) {
			if (editor.notebookParams.notebookUri === resource) {
				return notebookModeId;
			}
		}
		return sqlModeId;
	});
}