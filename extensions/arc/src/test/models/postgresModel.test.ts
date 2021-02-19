/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PGResourceInfo, ResourceType } from 'arc';
import * as azdata from 'azdata';
import * as azdataExt from 'azdata-ext';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import { v4 as uuid } from 'uuid';
import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import * as kubeUtils from '../../common/kubeUtils';
import { UserCancelledError } from '../../common/api';
import { PostgresModel } from '../../models/postgresModel';
import { ControllerModel, Registration } from '../../models/controllerModel';
import { FakeControllerModel } from '../mocks/fakeControllerModel';
import { ConnectToPGSqlDialog } from '../../ui/dialogs/connectPGDialog';
import { AzureArcTreeDataProvider } from '../../ui/tree/azureArcTreeDataProvider';

interface ExtensionGlobalMemento extends vscode.Memento {
	setKeysForSync(keys: string[]): void;
}

describe('PostgresModel', function (): void {
	afterEach(function (): void {
		sinon.restore();
	});

	describe('refresh', function (): void {
		let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
		let mockGlobalState: TypeMoq.IMock<ExtensionGlobalMemento>;

		before(function (): void {
			mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
			mockGlobalState = TypeMoq.Mock.ofType<ExtensionGlobalMemento>();
			mockExtensionContext.setup(x => x.globalState).returns(() => mockGlobalState.object);
		});

		beforeEach(function (): void {
			sinon.stub(vscode.window, 'showErrorMessage').resolves(<any>loc.yes);
		});

		it('Updates model to have expected config', async function (): Promise<void> {
			const azdataExtApiMock = TypeMoq.Mock.ofType<azdataExt.IExtension>();
			const azdataMock = TypeMoq.Mock.ofType<azdataExt.IAzdataApi>();
			azdataMock.setup(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
			azdataExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExtApiMock.object });

			const azdataShowResultMock = TypeMoq.Mock.ofType<azdataExt.AzdataOutput<azdataExt.PostgresServerShowResult>>();
			azdataShowResultMock.setup(x => x.)
			azdataMock.setup(x => x.arc.postgres.server.show(postgresModel.info.name, postgresModel.controllerModel.azdataAdditionalEnvVars, session)).returns(() => lPromise.resolve(azdataShowResultMock.object))


			const controllerModel = new FakeControllerModel();
			const session = await controllerModel.acquireAzdataSession();
			const postgresModel = new PostgresModel(new FakeControllerModel(),
				{ userName: 'postgres', name: 'arc-dc', resourceType: 'postgresInstances' },
				{ instanceName: 'pg_name', state: 'Ready', instanceType: ResourceType.postgresInstances },
				new AzureArcTreeDataProvider(mockExtensionContext.object));

			const config = sinon.stub(azdataExtApiMock.object.azdata.arc.postgres.server.show(postgresModel.info.name, postgresModel.controllerModel.azdataAdditionalEnvVars, session).returns(Promise.resolve({ controllerModel: newModel, password: password }));



			// Returning an undefined model here indicates that the dialog closed without clicking "Ok" - usually through the user clicking "Cancel"
			sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(undefined));
			/* const postgresModel = new PostgresModel(new FakeControllerModel(),
				{ userName: 'postgres', name: 'arc-dc', resourceType: 'postgresInstances' },
				{ instanceName: 'pg_name', state: 'Ready', instanceType: ResourceType.postgresInstances },
				new AzureArcTreeDataProvider(mockExtensionContext.object)); */
			await should(postgresModel.getEngineSettings()).be.rejectedWith(new UserCancelledError(loc.userCancelledError));
		});
	});

	describe('getConnectionProfile', function (): void {
		let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
		let mockGlobalState: TypeMoq.IMock<ExtensionGlobalMemento>;

		before(function (): void {
			mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
			mockGlobalState = TypeMoq.Mock.ofType<ExtensionGlobalMemento>();
			mockExtensionContext.setup(x => x.globalState).returns(() => mockGlobalState.object);
		});

		beforeEach(function (): void {
			sinon.stub(ConnectToPGSqlDialog.prototype, 'showDialog');
			sinon.stub(vscode.window, 'showErrorMessage').resolves(<any>loc.yes);
		});

		it('Rejected with expected error when user cancels', async function (): Promise<void> {
			// Returning an undefined model here indicates that the dialog closed without clicking "Ok" - usually through the user clicking "Cancel"
			sinon.stub(ConnectToPGSqlDialog.prototype, 'waitForClose').returns(Promise.resolve(undefined));
			const postgresModel = new PostgresModel(new FakeControllerModel(),
				{ userName: 'postgres', name: 'arc-dc', resourceType: 'postgresInstances' },
				{ instanceName: 'pg_name', state: 'Ready', instanceType: ResourceType.postgresInstances },
				new AzureArcTreeDataProvider(mockExtensionContext.object));
			await should(postgresModel.getEngineSettings()).be.rejectedWith(new UserCancelledError(loc.userCancelledError));
		});

		it('Reads password from cred store', async function (): Promise<void> {
			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Test password, not actually used")]

			// Set up cred store to return our password
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));


			const connectionResultMock = TypeMoq.Mock.ofType<azdata.ConnectionResult>();
			//connectionResultMock.setup(x => x.connected).returns(() => true);
			connectionResultMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.connection, 'connect').returns(Promise.resolve(connectionResultMock.object));
			const controllerModel = new FakeControllerModel();
			const postgresModel = new PostgresModel(controllerModel,
				{ userName: 'postgres', name: 'arc', resourceType: 'postgresInstances' },
				{ instanceName: 'pg_name', state: 'Ready', instanceType: ResourceType.postgresInstances },
				new AzureArcTreeDataProvider(mockExtensionContext.object));
			await should(postgresModel.getEngineSettings()).be.resolved();

			/* should(connectionResultStub.called).be.true('')

			should(connectionResultMock.waitForCloseStub.called).be.true('waitForClose should have been called');
			//await should(postgresModel.getEngineSettings()).be.resolved();



			await postgresModel.getEngineSettings();
			connectionResultMock.verify(x => x.connected)

			// Set up dialog to return new model with our new password from the reprompt
			const newModel = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] }, password);
			const waitForCloseStub = sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve({ controllerModel: newModel, password: password }));

			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] });

			await model.acquireAzdataSession(true);
			should(waitForCloseStub.called).be.true('waitForClose should have been called');
			azdataMock.verify(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());





			//const azdataExtApiMock = TypeMoq.Mock.ofType<azdataExt.IExtension>();
			const azdataMock = TypeMoq.Mock.ofType<azdataExt.IAzdataApi>();
			azdataMock.setup(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
			//azdataExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
			//sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExtApiMock.object });

			await postgresModel.controllerModel.acquireAzdataSession();

			azdataMock.verify(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());


			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Test password, not actually used")]

			// Set up cred store to return our password
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

			const azdataExtApiMock = TypeMoq.Mock.ofType<azdataExt.IExtension>();
			const azdataMock = TypeMoq.Mock.ofType<azdataExt.IAzdataApi>();
			azdataMock.setup(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
			azdataExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExtApiMock.object });
			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] });

			await model.acquireAzdataSession();
			azdataMock.verify(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once()); */

		});

		/* it('Prompt for password when not in cred store', async function (): Promise<void> {
			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Stub value for testing")]

			// Set up cred store to return empty password
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: '' }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

			const azdataExtApiMock = TypeMoq.Mock.ofType<azdataExt.IExtension>();
			const azdataMock = TypeMoq.Mock.ofType<azdataExt.IAzdataApi>();
			azdataMock.setup(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
			azdataExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExtApiMock.object });

			// Set up dialog to return new model with our password
			const newModel = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] }, password);
			sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve({ controllerModel: newModel, password: password }));

			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] });

			await model.acquireAzdataSession();
			azdataMock.verify(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());
		});

		it('Prompt for password when rememberPassword is true but prompt reconnect is true', async function (): Promise<void> {
			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Stub value for testing")]
			// Set up cred store to return a password to start with
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: 'originalPassword' }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

			const azdataExtApiMock = TypeMoq.Mock.ofType<azdataExt.IExtension>();
			const azdataMock = TypeMoq.Mock.ofType<azdataExt.IAzdataApi>();
			azdataMock.setup(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
			azdataExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExtApiMock.object });

			// Set up dialog to return new model with our new password from the reprompt
			const newModel = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] }, password);
			const waitForCloseStub = sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve({ controllerModel: newModel, password: password }));

			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] });

			await model.acquireAzdataSession(true);
			should(waitForCloseStub.called).be.true('waitForClose should have been called');
			azdataMock.verify(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());
		});

		it('Prompt for password when we already have a password but prompt reconnect is true', async function (): Promise<void> {
			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Stub value for testing")]
			// Set up cred store to return a password to start with
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: 'originalPassword' }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

			const azdataExtApiMock = TypeMoq.Mock.ofType<azdataExt.IExtension>();
			const azdataMock = TypeMoq.Mock.ofType<azdataExt.IAzdataApi>();
			azdataMock.setup(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
			azdataExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExtApiMock.object });

			// Set up dialog to return new model with our new password from the reprompt
			const newModel = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] }, password);
			const waitForCloseStub = sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve({ controllerModel: newModel, password: password }));

			// Set up original model with a password
			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), { id: uuid(), url: '127.0.0.1', kubeConfigFilePath: '/path/to/.kube/config', kubeClusterContext: 'currentCluster', username: 'admin', name: 'arc', rememberPassword: true, resources: [] }, 'originalPassword');

			await model.acquireAzdataSession(true);
			should(waitForCloseStub.called).be.true('waitForClose should have been called');
			azdataMock.verify(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());
		});

		it('Model values are updated correctly when modified during reconnect', async function (): Promise<void> {
			const treeDataProvider = new AzureArcTreeDataProvider(mockExtensionContext.object);

			// Set up cred store to return a password to start with
			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: 'originalPassword' }));
			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

			const azdataExtApiMock = TypeMoq.Mock.ofType<azdataExt.IExtension>();
			const azdataMock = TypeMoq.Mock.ofType<azdataExt.IAzdataApi>();
			azdataMock.setup(x => x.acquireSession(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
			azdataExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azdataExtApiMock.object });

			// Add existing model to provider
			const originalPassword = 'originalPassword';
			const model = new ControllerModel(
				treeDataProvider,
				{
					id: uuid(),
					url: '127.0.0.1',
					kubeConfigFilePath: '/path/to/.kube/config',
					kubeClusterContext: 'currentCluster',
					username: 'admin',
					name: 'arc',
					rememberPassword: false,
					resources: []
				},
				originalPassword
			);
			await treeDataProvider.addOrUpdateController(model, originalPassword);

			const newInfo: ControllerInfo = {
				id: model.info.id, // The ID stays the same since we're just re-entering information for the same model
				url: 'newUrl',
				kubeConfigFilePath: '/path/to/.kube/config',
				kubeClusterContext: 'currentCluster',
				username: 'newUser',
				name: 'newName',
				rememberPassword: true,
				resources: []
			};
			const newPassword = 'newPassword';
			// Set up dialog to return new model with our new password from the reprompt
			const newModel = new ControllerModel(
				treeDataProvider,
				newInfo,
				newPassword);
			const waitForCloseStub = sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve(
				{ controllerModel: newModel, password: newPassword }));

			await model.acquireAzdataSession(true);
			should(waitForCloseStub.called).be.true('waitForClose should have been called');
			should((await treeDataProvider.getChildren()).length).equal(1, 'Tree Data provider should still only have 1 node');
			should(model.info).deepEqual(newInfo, 'Model info should have been updated');

		}); */

	});

});
