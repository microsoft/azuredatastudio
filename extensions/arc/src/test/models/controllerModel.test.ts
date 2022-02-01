/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import { ControllerInfo } from 'arc';
// import * as azdata from 'azdata';
// import * as azExt from 'azdata-ext';
// import * as should from 'should';
// import * as sinon from 'sinon';
// import * as TypeMoq from 'typemoq';
// import { v4 as uuid } from 'uuid';
// import * as vscode from 'vscode';
// import * as loc from '../../localizedConstants';
// import * as kubeUtils from '../../common/kubeUtils';
// import { UserCancelledError } from '../../common/api';
// import { ControllerModel } from '../../models/controllerModel';
// import { ConnectToControllerDialog } from '../../ui/dialogs/connectControllerDialog';
// import { AzureArcTreeDataProvider } from '../../ui/tree/azureArcTreeDataProvider';

// interface ExtensionGlobalMemento extends vscode.Memento {
// 	setKeysForSync(keys: string[]): void;
// }

// function getDefaultControllerInfo(): ControllerInfo {
// 	return {
// 		id: uuid(),
// 		endpoint: '127.0.0.1',
// 		kubeConfigFilePath: '/path/to/.kube/config',
// 		kubeClusterContext: 'currentCluster',
// 		username: 'admin',
// 		name: 'arc',
// 		namespace: 'arc-ns',
// 		rememberPassword: true,
// 		resources: []
// 	};
// }

// describe('ControllerModel', function (): void {
// 	afterEach(function (): void {
// 		sinon.restore();
// 	});

// 	describe('azdataLogin', function (): void {
// 		let mockExtensionContext: TypeMoq.IMock<vscode.ExtensionContext>;
// 		let mockGlobalState: TypeMoq.IMock<ExtensionGlobalMemento>;

// 		before(function (): void {
// 			mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();
// 			mockGlobalState = TypeMoq.Mock.ofType<ExtensionGlobalMemento>();
// 			mockExtensionContext.setup(x => x.globalState).returns(() => mockGlobalState.object);
// 		});

// 		beforeEach(function (): void {
// 			sinon.stub(ConnectToControllerDialog.prototype, 'showDialog');
// 			sinon.stub(kubeUtils, 'getKubeConfigClusterContexts').returns([{ name: 'currentCluster', isCurrentContext: true }]);
// 			sinon.stub(vscode.window, 'showErrorMessage').resolves(<any>loc.yes);
// 		});

// 		it('Rejected with expected error when user cancels', async function (): Promise<void> {
// 			// Returning an undefined model here indicates that the dialog closed without clicking "Ok" - usually through the user clicking "Cancel"
// 			sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve(undefined));
// 			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), getDefaultControllerInfo());
// 			await should(model.login()).be.rejectedWith(new UserCancelledError(loc.userCancelledError));
// 		});

// 		it('Reads password from cred store', async function (): Promise<void> {
// 			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Test password, not actually used")]

// 			// Set up cred store to return our password
// 			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
// 			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: password }));
// 			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
// 			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

// 			const azExtApiMock = TypeMoq.Mock.ofType<azExt.IExtension>();
// 			const azdataMock = TypeMoq.Mock.ofType<azExt.IAzdataApi>();
// 			azdataMock.setup(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
// 			azExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
// 			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azExtApiMock.object });
// 			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), getDefaultControllerInfo());

// 			await model.login();
// 			azdataMock.verify(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());
// 		});

// 		it('Prompt for password when not in cred store', async function (): Promise<void> {
// 			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Stub value for testing")]

// 			// Set up cred store to return empty password
// 			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
// 			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: '' }));
// 			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
// 			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

// 			const azExtApiMock = TypeMoq.Mock.ofType<azExt.IExtension>();
// 			const azdataMock = TypeMoq.Mock.ofType<azExt.IAzdataApi>();
// 			azdataMock.setup(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
// 			azExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
// 			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azExtApiMock.object });

// 			// Set up dialog to return new model with our password
// 			const newModel = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), getDefaultControllerInfo(), password);
// 			sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve({ controllerModel: newModel, password: password }));

// 			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), getDefaultControllerInfo());

// 			await model.login();
// 			azdataMock.verify(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());
// 		});

// 		it('Prompt for password when rememberPassword is true but prompt reconnect is true', async function (): Promise<void> {
// 			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Stub value for testing")]
// 			// Set up cred store to return a password to start with
// 			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
// 			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: 'originalPassword' }));
// 			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
// 			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

// 			const azExtApiMock = TypeMoq.Mock.ofType<azExt.IExtension>();
// 			const azdataMock = TypeMoq.Mock.ofType<azExt.IAzdataApi>();
// 			azdataMock.setup(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
// 			azExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
// 			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azExtApiMock.object });

// 			// Set up dialog to return new model with our new password from the reprompt
// 			const newModel = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), getDefaultControllerInfo(), password);
// 			const waitForCloseStub = sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve({ controllerModel: newModel, password: password }));

// 			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), getDefaultControllerInfo());

// 			await model.login(true);
// 			should(waitForCloseStub.called).be.true('waitForClose should have been called');
// 			azdataMock.verify(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());
// 		});

// 		it('Prompt for password when we already have a password but prompt reconnect is true', async function (): Promise<void> {
// 			const password = 'password123'; // [SuppressMessage("Microsoft.Security", "CS001:SecretInline", Justification="Stub value for testing")]
// 			// Set up cred store to return a password to start with
// 			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
// 			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: 'originalPassword' }));
// 			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
// 			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

// 			const azExtApiMock = TypeMoq.Mock.ofType<azExt.IExtension>();
// 			const azdataMock = TypeMoq.Mock.ofType<azExt.IAzdataApi>();
// 			azdataMock.setup(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
// 			azExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
// 			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azExtApiMock.object });

// 			// Set up dialog to return new model with our new password from the reprompt
// 			const newModel = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), getDefaultControllerInfo(), password);
// 			const waitForCloseStub = sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve({ controllerModel: newModel, password: password }));

// 			// Set up original model with a password
// 			const model = new ControllerModel(new AzureArcTreeDataProvider(mockExtensionContext.object), getDefaultControllerInfo(), 'originalPassword');

// 			await model.login(true);
// 			should(waitForCloseStub.called).be.true('waitForClose should have been called');
// 			azdataMock.verify(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), password, TypeMoq.It.isAny()), TypeMoq.Times.once());
// 		});

// 		it('Model values are updated correctly when modified during reconnect', async function (): Promise<void> {
// 			const treeDataProvider = new AzureArcTreeDataProvider(mockExtensionContext.object);

// 			// Set up cred store to return a password to start with
// 			const credProviderMock = TypeMoq.Mock.ofType<azdata.CredentialProvider>();
// 			credProviderMock.setup(x => x.readCredential(TypeMoq.It.isAny())).returns(() => Promise.resolve({ credentialId: 'id', password: 'originalPassword' }));
// 			// Need to setup then when Promise.resolving a mocked object : https://github.com/florinn/typemoq/issues/66
// 			credProviderMock.setup((x: any) => x.then).returns(() => undefined);
// 			sinon.stub(azdata.credentials, 'getProvider').returns(Promise.resolve(credProviderMock.object));

// 			const azExtApiMock = TypeMoq.Mock.ofType<azExt.IExtension>();
// 			const azdataMock = TypeMoq.Mock.ofType<azExt.IAzdataApi>();
// 			azdataMock.setup(x => x.login(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => <any>Promise.resolve(undefined));
// 			azExtApiMock.setup(x => x.azdata).returns(() => azdataMock.object);
// 			sinon.stub(vscode.extensions, 'getExtension').returns(<any>{ exports: azExtApiMock.object });

// 			// Add existing model to provider
// 			const originalPassword = 'originalPassword';
// 			const model = new ControllerModel(
// 				treeDataProvider,
// 				getDefaultControllerInfo(),
// 				originalPassword
// 			);
// 			await treeDataProvider.addOrUpdateController(model, originalPassword);

// 			const newInfo: ControllerInfo = {
// 				id: model.info.id, // The ID stays the same since we're just re-entering information for the same model
// 				endpoint: 'newUrl',
// 				kubeConfigFilePath: '/path/to/.kube/config',
// 				kubeClusterContext: 'currentCluster',
// 				username: 'newUser',
// 				name: 'newName',
// 				namespace: 'newNamespace',
// 				rememberPassword: true,
// 				resources: []
// 			};
// 			const newPassword = 'newPassword';
// 			// Set up dialog to return new model with our new password from the reprompt
// 			const newModel = new ControllerModel(
// 				treeDataProvider,
// 				newInfo,
// 				newPassword);
// 			const waitForCloseStub = sinon.stub(ConnectToControllerDialog.prototype, 'waitForClose').returns(Promise.resolve(
// 				{ controllerModel: newModel, password: newPassword }));

// 			await model.login(true);
// 			should(waitForCloseStub.called).be.true('waitForClose should have been called');
// 			should((await treeDataProvider.getChildren()).length).equal(1, 'Tree Data provider should still only have 1 node');
// 			should(model.info).deepEqual(newInfo, 'Model info should have been updated');

// 		});

// 	});

// });
