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

import { LocalContentManager } from 'sql/workbench/services/notebook/node/localContentManager';
import * as testUtils from '../../../utils/testUtils';
import { NotebookManagerStub } from '../common';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';
import { ModelFactory } from 'sql/parts/notebook/models/modelFactory';
import { IClientSession, ICellModel, INotebookModelOptions } from 'sql/parts/notebook/models/modelInterfaces';
import { ClientSession } from 'sql/parts/notebook/models/clientSession';
import { CellTypes } from 'sql/parts/notebook/models/contracts';
import { Deferred } from 'sql/base/common/promise';
import { ConnectionManagementService } from 'sql/platform/connection/common/connectionManagementService';
import { Memento } from 'vs/workbench/common/memento';
import { Emitter } from 'vs/base/common/event';
import { CapabilitiesTestService } from 'sqltest/stubs/capabilitiesTestService';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

let expectedNotebookContent: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: 'insert into t1 values (c1, c2)',
		metadata: { language: 'python' },
		execution_count: 1
	}, {
		cell_type: CellTypes.Markdown,
		source: 'I am *markdown*',
		metadata: { language: 'python' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'mssql',
			language: 'sql'
		}
	},
	nbformat: 4,
	nbformat_minor: 5
};

let expectedNotebookContentOneCell: nb.INotebookContents = {
	cells: [{
		cell_type: CellTypes.Code,
		source: 'insert into t1 values (c1, c2)',
		metadata: { language: 'python' },
		execution_count: 1
	}],
	metadata: {
		kernelspec: {
			name: 'mssql',
			language: 'sql'
		}
	},
	nbformat: 4,
	nbformat_minor: 5
};

let defaultUri = URI.file('/some/path.ipynb');

let mockClientSession: TypeMoq.Mock<IClientSession>;
let sessionReady: Deferred<void>;
let mockModelFactory: TypeMoq.Mock<ModelFactory>;
let notificationService: TypeMoq.Mock<INotificationService>;
let capabilitiesService: TypeMoq.Mock<ICapabilitiesService>;

suite('notebook model', function(): void {
    let notebookManagers = [new NotebookManagerStub()];
    let memento: TypeMoq.Mock<Memento>;
    let queryConnectionService: TypeMoq.Mock<ConnectionManagementService>;
    let defaultModelOptions: INotebookModelOptions;
    setup(() => {
        sessionReady = new Deferred<void>();
        notificationService = TypeMoq.Mock.ofType(TestNotificationService, TypeMoq.MockBehavior.Loose);
        capabilitiesService = TypeMoq.Mock.ofType(CapabilitiesTestService);
        memento = TypeMoq.Mock.ofType(Memento, TypeMoq.MockBehavior.Loose, '');
        memento.setup(x => x.getMemento(TypeMoq.It.isAny())).returns(() => void 0);
        queryConnectionService = TypeMoq.Mock.ofType(ConnectionManagementService, TypeMoq.MockBehavior.Loose, memento.object, undefined);
        queryConnectionService.callBase = true;
        defaultModelOptions = {
            notebookUri: defaultUri,
            factory: new ModelFactory(),
            notebookManagers,
            notificationService: notificationService.object,
            connectionService: queryConnectionService.object,
            providerId: 'SQL',
            standardKernels: [{ name: 'SQL', connectionProviderIds: ['MSSQL'], notebookProvider: 'sql' }],
            cellMagicMapper: undefined,
            defaultKernel: undefined,
            layoutChanged: undefined,
            capabilitiesService: capabilitiesService.object
        };
        mockClientSession = TypeMoq.Mock.ofType(ClientSession, undefined, defaultModelOptions);
        mockClientSession.setup(c => c.initialize()).returns(() => {
            return Promise.resolve();
        });
        mockClientSession.setup(c => c.ready).returns(() => sessionReady.promise);
        mockModelFactory = TypeMoq.Mock.ofType(ModelFactory);
        mockModelFactory.callBase = true;
        mockModelFactory.setup(f => f.createClientSession(TypeMoq.It.isAny())).returns(() => {
            return mockClientSession.object;
        });
    });

    test('Should create no cells if model has no contents', async function(): Promise<void> {
        // Given an empty notebook
        let emptyNotebook: nb.INotebookContents = {
            cells: [],
            metadata: {
                kernelspec: {
                    name: 'mssql',
                    language: 'sql'
                }
            },
            nbformat: 4,
            nbformat_minor: 5
        };

        let mockContentManager = TypeMoq.Mock.ofType(LocalContentManager);
        mockContentManager.setup(c => c.getNotebookContents(TypeMoq.It.isAny())).returns(() => Promise.resolve(emptyNotebook));
        notebookManagers[0].contentManager = mockContentManager.object;

        // When I initialize the model
        let model = new NotebookModel(defaultModelOptions);
        await model.requestModelLoad();

        // Then I expect to have 0 code cell as the contents
        should(model.cells).have.length(0);
    });

    test('Should throw if model load fails', async function(): Promise<void> {
        // Given a call to get Contents fails
        let error = new Error('File not found');
        let mockContentManager = TypeMoq.Mock.ofType(LocalContentManager);
        mockContentManager.setup(c => c.getNotebookContents(TypeMoq.It.isAny())).throws(error);
        notebookManagers[0].contentManager = mockContentManager.object;

        // When I initalize the model
        // Then it should throw
        let model = new NotebookModel(defaultModelOptions);
        should(model.inErrorState).be.false();
        await testUtils.assertThrowsAsync(() => model.requestModelLoad(), error.message);
        should(model.inErrorState).be.true();
    });

    test('Should convert cell info to CellModels', async function(): Promise<void> {
        // Given a notebook with 2 cells
        let mockContentManager = TypeMoq.Mock.ofType(LocalContentManager);
        mockContentManager.setup(c => c.getNotebookContents(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedNotebookContent));
        notebookManagers[0].contentManager = mockContentManager.object;

        // When I initalize the model
        let model = new NotebookModel(defaultModelOptions);
        await model.requestModelLoad();

        // Then I expect all cells to be in the model
        should(model.cells).have.length(2);
        should(model.cells[0].source).be.equal(expectedNotebookContent.cells[0].source);
        should(model.cells[1].source).be.equal(expectedNotebookContent.cells[1].source);
    });

    test('Should load contents but then go to error state if client session startup fails', async function(): Promise<void> {
        let mockContentManager = TypeMoq.Mock.ofType(LocalContentManager);
        mockContentManager.setup(c => c.getNotebookContents(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedNotebookContentOneCell));
        notebookManagers[0].contentManager = mockContentManager.object;

        // Given I have a session that fails to start
        mockClientSession.setup(c => c.isInErrorState).returns(() => true);
        mockClientSession.setup(c => c.errorMessage).returns(() => 'Error');
        sessionReady.resolve();
        let sessionFired = false;

        let options: INotebookModelOptions = Object.assign({}, defaultModelOptions, <Partial<INotebookModelOptions>> {
            factory: mockModelFactory.object
        });
        let model = new NotebookModel(options);
        model.onClientSessionReady((session) => sessionFired = true);
        await model.requestModelLoad();
        model.backgroundStartSession();

        // Then I expect load to succeed
        shouldHaveOneCell(model);
        should(model.clientSession).not.be.undefined();
        // but on server load completion I expect error state to be set
        // Note: do not expect serverLoad event to throw even if failed
        await model.sessionLoadFinished;
        should(model.inErrorState).be.true();
        should(sessionFired).be.false();
    });

    test('Should not be in error state if client session initialization succeeds', async function(): Promise<void> {
        let mockContentManager = TypeMoq.Mock.ofType(LocalContentManager);
        mockContentManager.setup(c => c.getNotebookContents(TypeMoq.It.isAny())).returns(() => Promise.resolve(expectedNotebookContentOneCell));
        notebookManagers[0].contentManager = mockContentManager.object;
        let kernelChangedEmitter: Emitter<nb.IKernelChangedArgs> = new Emitter<nb.IKernelChangedArgs>();
        let statusChangedEmitter: Emitter<nb.ISession> = new Emitter<nb.ISession>();

        mockClientSession.setup(c => c.isInErrorState).returns(() => false);
        mockClientSession.setup(c => c.isReady).returns(() => true);
        mockClientSession.setup(c => c.kernelChanged).returns(() => kernelChangedEmitter.event);
        mockClientSession.setup(c => c.statusChanged).returns(() => statusChangedEmitter.event);

        queryConnectionService.setup(c => c.getActiveConnections(TypeMoq.It.isAny())).returns(() => null);

        sessionReady.resolve();
        let actualSession: IClientSession = undefined;

        let options: INotebookModelOptions = Object.assign({}, defaultModelOptions, <Partial<INotebookModelOptions>> {
            factory: mockModelFactory.object
        });
        let model = new NotebookModel(options, false);
        model.onClientSessionReady((session) => actualSession = session);
        await model.requestModelLoad();
        model.backgroundStartSession();

        // Then I expect load to succeed
        should(model.clientSession).not.be.undefined();
        // but on server load completion I expect error state to be set
        // Note: do not expect serverLoad event to throw even if failed
        let kernelChangedArg: nb.IKernelChangedArgs = undefined;
        model.kernelChanged((kernel) => kernelChangedArg = kernel);
        await model.sessionLoadFinished;
        should(model.inErrorState).be.false();
        should(actualSession).equal(mockClientSession.object);
        should(model.clientSession).equal(mockClientSession.object);
    });

    test('Should sanitize kernel display name when IP is included', async function(): Promise<void> {
        let model = new NotebookModel(defaultModelOptions);
        let displayName = 'PySpark (1.1.1.1)';
        let sanitizedDisplayName = model.sanitizeDisplayName(displayName);
        should(sanitizedDisplayName).equal('PySpark');
    });

    test('Should sanitize kernel display name properly when IP is not included', async function(): Promise<void> {
        let model = new NotebookModel(defaultModelOptions);
        let displayName = 'PySpark';
        let sanitizedDisplayName = model.sanitizeDisplayName(displayName);
        should(sanitizedDisplayName).equal('PySpark');
    });

    function shouldHaveOneCell(model: NotebookModel): void {
        should(model.cells).have.length(1);
        verifyCellModel(model.cells[0], { cell_type: CellTypes.Code, source: 'insert into t1 values (c1, c2)', metadata: { language: 'python' }, execution_count: 1 });
    }

    function verifyCellModel(cellModel: ICellModel, expected: nb.ICellContents): void {
        should(cellModel.cellType).equal(expected.cell_type);
        should(cellModel.source).equal(expected.source);
    }

});
