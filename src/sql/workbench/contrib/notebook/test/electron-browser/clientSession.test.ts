/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import { nb } from 'azdata';
import * as assert from 'assert';

import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { URI } from 'vs/base/common/uri';

import { ClientSession } from 'sql/workbench/services/notebook/browser/models/clientSession';
import { SessionManager, EmptySession } from 'sql/workbench/contrib/notebook/test/emptySessionClasses';
import { NotebookManagerStub, ServerManagerStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { isUndefinedOrNull } from 'vs/base/common/types';

suite('Client Session', function (): void {
	let path = URI.file('my/notebook.ipynb');
	let notebookManager: NotebookManagerStub;
	let serverManager: ServerManagerStub;
	let mockSessionManager: TypeMoq.Mock<nb.SessionManager>;
	let notificationService: TypeMoq.Mock<INotificationService>;
	let session: ClientSession;

	setup(() => {
		serverManager = new ServerManagerStub();
		mockSessionManager = TypeMoq.Mock.ofType(SessionManager);
		notebookManager = new NotebookManagerStub();
		notebookManager.serverManager = serverManager;
		notebookManager.sessionManager = mockSessionManager.object;
		notificationService = TypeMoq.Mock.ofType(TestNotificationService, TypeMoq.MockBehavior.Loose);

		session = new ClientSession({
			notebookManager: notebookManager,
			notebookUri: path,
			notificationService: notificationService.object,
			kernelSpec: { name: 'python', display_name: 'Python 3', language: 'python' }
		});

		let serverlessNotebookManager = new NotebookManagerStub();
		serverlessNotebookManager.sessionManager = mockSessionManager.object;
	});

	test('Should set path, isReady and ready on construction', function (): void {
		assert.equal(session.notebookUri, path);
		assert(!isUndefinedOrNull(session.ready));
		assert(!session.isReady);
		assert.equal(session.status, 'starting');
		assert(!session.isInErrorState);
		assert(isUndefinedOrNull(session.errorMessage));
	});

	test('Should call on serverManager startup if set', async function (): Promise<void> {
		// Given I have a serverManager that starts successfully
		serverManager.result = Promise.resolve();
		assert(!session.isReady);

		// When I kick off initialization
		await session.initialize();

		// Then I expect ready to be completed too
		await session.ready;
		assert(serverManager.calledStart);
		assert(session.isReady);
	});

	test('Should go to error state if serverManager startup fails', async function (): Promise<void> {
		// Given I have a serverManager that fails to start
		serverManager.result = Promise.reject('error');
		assert(!session.isInErrorState);

		// When I initialize
		await session.initialize();

		// Then I expect ready to complete, but isInErrorState to be true
		await session.ready;
		assert(session.isReady);
		assert(serverManager.calledStart);
		assert(session.isInErrorState);
		assert.equal(session.errorMessage, 'error');
	});

	test('Should be ready when session manager is ready', async function (): Promise<void> {
		serverManager.result = new Promise((resolve) => {
			serverManager.isStarted = true;
			resolve();
		});
		let sessionMock = TypeMoq.Mock.ofType(EmptySession);

		mockSessionManager.setup(s => s.ready).returns(() => Promise.resolve());
		mockSessionManager.setup(s => s.startNew(TypeMoq.It.isAny())).returns((options) => {
			return Promise.resolve(sessionMock.object);
		});

		// When I call initialize
		await session.initialize();

		// Then
		assert(session.isReady);
		assert(!session.isInErrorState);
		await session.ready;
	});

	test('Should be in error state if server fails to start', async function (): Promise<void> {
		serverManager.result = new Promise((resolve) => {
			serverManager.isStarted = false;
			resolve();
		});
		mockSessionManager.setup(s => s.ready).returns(() => Promise.resolve());

		// When I call initialize
		await session.initialize();

		// Then
		await session.ready;
		assert(session.isReady);
		assert(session.isInErrorState);
	});

	test('Should go to error state if sessionManager fails', async function (): Promise<void> {
		serverManager.isStarted = true;
		mockSessionManager.setup(s => s.isReady).returns(() => false);
		mockSessionManager.setup(s => s.ready).returns(() => Promise.reject('error'));

		// When I call initialize
		await session.initialize();

		// Then
		assert(session.isReady);
		assert(session.isInErrorState);
		assert.equal(session.errorMessage, 'error');
	});

	test('Should start session automatically if kernel preference requests it', async function (): Promise<void> {
		serverManager.isStarted = true;
		mockSessionManager.setup(s => s.ready).returns(() => Promise.resolve());
		let sessionMock = TypeMoq.Mock.ofType(EmptySession);
		let startOptions: nb.ISessionOptions = undefined;
		mockSessionManager.setup(s => s.startNew(TypeMoq.It.isAny())).returns((options) => {
			startOptions = options;
			return Promise.resolve(sessionMock.object);
		});
		await session.initialize();

		// Then
		assert.equal(session.isReady, true, 'Session is not ready');
		assert.equal(session.isInErrorState, false, 'Session should not be in error state');
		assert.equal(startOptions.kernelName, 'python', 'Session not started with python by default');
		assert.equal(startOptions.path, path.fsPath, 'Session start path is incorrect');
	});

	test('Should shutdown session even if no serverManager is set', async function (): Promise<void> {
		// Given a session against a remote server
		let emptySession = new EmptySession({
			path: path.toString(),
			kernelId: '1',
			kernelName: 'python',
			name: 'emptySession',
			type: 'type'
		});

		mockSessionManager.setup(s => s.isReady).returns(() => true);
		mockSessionManager.setup(s => s.shutdown(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		mockSessionManager.setup(s => s.startNew(TypeMoq.It.isAny())).returns(() => Promise.resolve(emptySession));
		let newNotebookManager = notebookManager;
		newNotebookManager.serverManager = undefined;

		let remoteSession = new ClientSession({
			kernelSpec: { name: 'python', display_name: 'Python 3', language: 'python' },
			notebookManager: newNotebookManager,
			notebookUri: path,
			notificationService: notificationService.object
		});
		await remoteSession.initialize();

		// When I call shutdown
		await remoteSession.shutdown();

		// Then
		mockSessionManager.verify(s => s.shutdown(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});

});
