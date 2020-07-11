/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ExtHostCredentialManagement } from 'sql/workbench/api/common/extHostCredentialManagement';
import { SqlMainContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IRPCProtocol } from 'vs/workbench/services/extensions/common/proxyIdentifier';
import { MainThreadCredentialManagement } from 'sql/workbench/api/browser/mainThreadCredentialManagement';
import { ICredentialsService } from 'sql/platform/credentials/common/credentialsService';
import { Credential, CredentialProvider } from 'azdata';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { TestCredentialsService, TestCredentialsProvider } from 'sql/platform/credentials/test/common/testCredentialsService';
import { TestRPCProtocol } from 'vs/workbench/test/browser/api/testRPCProtocol';

const IRPCProtocol = createDecorator<IRPCProtocol>('rpcProtocol');

// SUITE STATE /////////////////////////////////////////////////////////////
let credentialServiceStub: TestCredentialsService;
let instantiationService: TestInstantiationService;
let threadService: TestRPCProtocol;

// TESTS ///////////////////////////////////////////////////////////////////
suite('ExtHostCredentialManagement', () => {
	suiteSetup(() => {
		threadService = new TestRPCProtocol();
		credentialServiceStub = new TestCredentialsService();

		instantiationService = new TestInstantiationService();
		instantiationService.stub(IRPCProtocol, threadService);
		instantiationService.stub(ICredentialsService, credentialServiceStub);

		const credentialService = instantiationService.createInstance(MainThreadCredentialManagement, undefined);
		threadService.set(SqlMainContext.MainThreadCredentialManagement, credentialService);
	});

	test('Construct ExtHostCredentialManagement', () => {
		// If: I construct an credential management extension host
		let extHost = new ExtHostCredentialManagement(threadService);

		// Then: The extension host should not have any providers registered
		assert.equal(extHost.getProviderCount(), 0);
	});

	test('Register Credential Provider', () => {
		// Setup: Create a mock credential provider
		let extHost = new ExtHostCredentialManagement(threadService);
		let mockCredentialProvider = new TestCredentialsProvider();

		// If: I register the credential provider with the extension host
		extHost.$registerCredentialProvider(mockCredentialProvider);

		// Then: There should be one provider registered
		assert.equal(extHost.getProviderCount(), 1);
	});

	test('Get Credential Provider - Success', () => {
		// Setup: Register a mock credential provider
		let extHost = new ExtHostCredentialManagement(threadService);
		let mockCredentialProvider = new TestCredentialsProvider();
		extHost.$registerCredentialProvider(mockCredentialProvider);

		// If: I get the credential provider
		let namespaceId = 'test_namespace';
		let credentialId = 'test_id';
		let credential = 'test_credential';
		let expectedCredentialId = `${namespaceId}|${credentialId}`;
		let credProvider: CredentialProvider;
		return extHost.$getCredentialProvider(namespaceId)
			.then((provider) => {
				// Then: There should still only be one provider registered
				assert.equal(extHost.getProviderCount(), 1);
				credProvider = provider;
			})
			.then(() => {
				// If: I write a credential
				return credProvider.saveCredential(credentialId, credential);
			})
			.then(() => {
				// Then: The credential should have been stored with its namespace
				assert.notStrictEqual(mockCredentialProvider.storedCredentials[expectedCredentialId], undefined);
				assert.equal(mockCredentialProvider.storedCredentials[expectedCredentialId].credentialId, expectedCredentialId);
				assert.equal(mockCredentialProvider.storedCredentials[expectedCredentialId].password, credential);
			})
			.then(() => {
				// If: I read a credential
				return credProvider.readCredential(credentialId);
			})
			.then((returnedCredential: Credential) => {
				// Then: The credential ID should be namespaced
				assert.equal(returnedCredential.credentialId, expectedCredentialId);
				assert.equal(returnedCredential.password, credential);
			})
			.then(() => {
				// If: I delete a credential
				return credProvider.deleteCredential(credentialId);
			})
			.then(() => {
				// Then: The credential with its namespace should no longer exist
				assert.strictEqual(mockCredentialProvider.storedCredentials[expectedCredentialId], undefined);
			});
	});

	test('Get Credential Provider - No Namespace', async () => {
		// Setup: Register a mock credential provider
		let extHost = new ExtHostCredentialManagement(threadService);
		let mockCredentialProvider = new TestCredentialsProvider();
		extHost.$registerCredentialProvider(mockCredentialProvider);

		// If: I get a credential provider with an invalid namespace ID
		// Then: I should get an error
		try {
			await extHost.$getCredentialProvider(undefined);
			assert.fail('Provider was returned from undefined');
		} catch (e) { }

		try {
			await extHost.$getCredentialProvider(null);
			assert.fail('Provider was returned from null');
		} catch (e) { }

		try {
			await extHost.$getCredentialProvider('');
			assert.fail('Provider was returned from \'\'');
		} catch (e) { }
	});
});
