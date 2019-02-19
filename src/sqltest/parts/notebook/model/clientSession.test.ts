
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import { nb } from 'sqlops';

import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { URI } from 'vs/base/common/uri';

import { ClientSession } from 'sql/parts/notebook/models/clientSession';
import { SessionManager, EmptySession } from 'sql/workbench/services/notebook/common/sessionManager';
import { NotebookManagerStub, ServerManagerStub } from 'sqltest/parts/notebook/common';

suite('Client Session', function (): void {
	let path = URI.file('my/notebook.ipynb');
	let notebookManager: NotebookManagerStub;
	let serverManager: ServerManagerStub;
	let mockSessionManager: TypeMoq.Mock<nb.SessionManager>;
	let notificationService: TypeMoq.Mock<INotificationService>;
	let session: ClientSession;
	let remoteSession: ClientSession;

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
			notificationService: notificationService.object
		});

		let serverlessNotebookManager = new NotebookManagerStub();
		serverlessNotebookManager.sessionManager = mockSessionManager.object;
		remoteSession = new ClientSession({
			notebookManager: serverlessNotebookManager,
			notebookUri: path,
			notificationService: notificationService.object
		});
	});

	test('Should set path, isReady and ready on construction', function (): void {
		should(session.notebookUri).equal(path);
		should(session.ready).not.be.undefined();
		should(session.isReady).be.false();
		should(session.status).equal('starting');
		should(session.isInErrorState).be.false();
		should(session.errorMessage).be.undefined();
	});

	test('Should call on serverManager startup if set', async function (): Promise<void> {
		// Given I have a serverManager that starts successfully
		serverManager.result = Promise.resolve();
		should(session.isReady).be.false();

		// When I kick off initialization
		await session.initialize();

		// Then I expect ready to be completed too
		await session.ready;
		should(serverManager.calledStart).be.true();
		should(session.isReady).be.true();
	});

	test('Should go to error state if serverManager startup fails', async function (): Promise<void> {
		// Given I have a serverManager that fails to start
		serverManager.result = Promise.reject('error');
		should(session.isInErrorState).be.false();

		// When I initialize
		await session.initialize();

		// Then I expect ready to complete, but isInErrorState to be true
		await session.ready;
		should(session.isReady).be.true();
		should(serverManager.calledStart).be.true();
		should(session.isInErrorState).be.true();
		should(session.errorMessage).equal('error');
	});

	test('Should be ready when session manager is ready', async function (): Promise<void> {
		serverManager.result = new Promise((resolve) => {
			serverManager.isStarted = true;
			resolve();
		});
		mockSessionManager.setup(s => s.ready).returns(() => Promise.resolve());

		// When I call initialize
		await session.initialize();

		// Then
		should(session.isReady).be.true();
		should(session.isInErrorState).be.false();
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
		should(session.isReady).be.true();
		should(session.isInErrorState).be.true();
	});

	test('Should go to error state if sessionManager fails', async function (): Promise<void> {
		serverManager.isStarted = true;
		mockSessionManager.setup(s => s.isReady).returns(() => false);
		mockSessionManager.setup(s => s.ready).returns(() => Promise.reject('error'));

		// When I call initialize
		await session.initialize();

		// Then
		should(session.isReady).be.true();
		should(session.isInErrorState).be.true();
		should(session.errorMessage).equal('error');
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

		// When I call initialize after defining kernel preferences
		session.kernelPreference = {
			shouldStart: true,
			name: 'python'
		};
		await session.initialize();

		// Then
		should(session.isReady).be.true();
		should(session.isInErrorState).be.false();
		should(startOptions.kernelName).equal('python');
		should(startOptions.path).equal(path.fsPath);
	});

	test('Should shutdown session even if no serverManager is set', async function (): Promise<void> {
		// Given a session against a remote server
		let expectedId = 'abc';
		mockSessionManager.setup(s => s.isReady).returns(() => true);
		mockSessionManager.setup(s => s.shutdown(TypeMoq.It.isAny())).returns(() => Promise.resolve());
		let sessionMock = TypeMoq.Mock.ofType(EmptySession);
		sessionMock.setup(s => s.id).returns(() => expectedId);
		mockSessionManager.setup(s => s.startNew(TypeMoq.It.isAny())).returns(() => Promise.resolve(sessionMock.object));

		remoteSession.kernelPreference = {
			shouldStart: true,
			name: 'python'
		};
		await remoteSession.initialize();

		// When I call shutdown
		await remoteSession.shutdown();

		// Then
		mockSessionManager.verify(s => s.shutdown(TypeMoq.It.isValue(expectedId)), TypeMoq.Times.once());
	});

});
