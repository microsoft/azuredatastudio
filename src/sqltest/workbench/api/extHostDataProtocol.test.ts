/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { setUnexpectedErrorHandler, errorHandler } from 'vs/base/common/errors';
import URI from 'vs/base/common/uri';
import * as EditorCommon from 'vs/editor/common/editorCommon';
import { Model as EditorModel } from 'vs/editor/common/model/model';
import { TestThreadService } from 'vs/workbench/test/electron-browser/api/testThreadService';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IMarkerService } from 'vs/platform/markers/common/markers';
import { MarkerService } from 'vs/platform/markers/common/markerService';
import { IThreadService } from 'vs/workbench/services/thread/common/threadService';
import { ExtHostCommands } from 'vs/workbench/api/node/extHostCommands';
import { MainThreadCommands } from 'vs/workbench/api/electron-browser/mainThreadCommands';
import { IHeapService } from 'vs/workbench/api/electron-browser/mainThreadHeapService';
import { ExtHostDocuments } from 'vs/workbench/api/node/extHostDocuments';
import { ExtHostDocumentsAndEditors } from 'vs/workbench/api/node/extHostDocumentsAndEditors';
import { DocumentSymbolProviderRegistry } from 'vs/editor/common/modes';
import { MainContext, ExtHostContext } from 'vs/workbench/api/node/extHost.protocol';
import { ExtHostDiagnostics } from 'vs/workbench/api/node/extHostDiagnostics';
import { ExtHostHeapService } from 'vs/workbench/api/node/extHostHeapService';
import * as vscode from 'vscode';

import * as sqlops from 'sqlops';
import { ExtHostDataProtocol } from 'sql/workbench/api/node/extHostDataProtocol';
import { SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';

const IThreadService = createDecorator<IThreadService>('threadService');

const model: EditorCommon.IModel = EditorModel.createFromString(
	[
		'This is the first line',
		'This is the second line',
		'This is the third line',
	].join('\n'),
	undefined,
	undefined,
	URI.parse('far://testing/file.a'));

let extHost: ExtHostDataProtocol;
let disposables: vscode.Disposable[] = [];
let threadService: TestThreadService;
let originalErrorHandler: (e: any) => any;

suite('ExtHostDataProtocol', function () {

	suiteSetup(() => {

		// threadService = new TestThreadService();
		// let instantiationService = new TestInstantiationService();
		// instantiationService.stub(IThreadService, threadService);
		// instantiationService.stub(IMarkerService, MarkerService);
		// instantiationService.stub(IHeapService, {
		// 	_serviceBrand: undefined,
		// 	trackRecursive(args) {
		// 		// nothing
		// 		return args;
		// 	}
		// });

		// originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		// setUnexpectedErrorHandler(() => { });

		// const extHostDocumentsAndEditors = new ExtHostDocumentsAndEditors(threadService);
		// extHostDocumentsAndEditors.$acceptDocumentsAndEditorsDelta({
		// 	addedDocuments: [{
		// 		isDirty: false,
		// 		versionId: model.getVersionId(),
		// 		modeId: model.getLanguageIdentifier().language,
		// 		url: model.uri,
		// 		lines: model.getValue().split(model.getEOL()),
		// 		EOL: model.getEOL(),
		// 	}]
		// });
		// const extHostDocuments = new ExtHostDocuments(threadService, extHostDocumentsAndEditors);
		// threadService.set(ExtHostContext.ExtHostDocuments, extHostDocuments);

		// const heapService = new ExtHostHeapService();

		// const commands = new ExtHostCommands(threadService, heapService);
		// threadService.set(ExtHostContext.ExtHostCommands, commands);
		// threadService.setTestInstance(MainContext.MainThreadCommands, instantiationService.createInstance(MainThreadCommands));

		// const diagnostics = new ExtHostDiagnostics(threadService);
		// threadService.set(ExtHostContext.ExtHostDiagnostics, diagnostics);

		// extHost = new ExtHostDataProtocol(threadService);
		// threadService.set(SqlExtHostContext.ExtHostDataProtocol, extHost);
	});

	suiteTeardown(() => {
		// setUnexpectedErrorHandler(originalErrorHandler);
		// model.dispose();
	});

	teardown(function () {
		// while (disposables.length) {
		// 	disposables.pop().dispose();
		// }
		// return threadService.sync();
	});

	// --- outline
});
