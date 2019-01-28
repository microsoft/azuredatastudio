/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { TestRPCProtocol } from 'vs/workbench/test/electron-browser/api/testRPCProtocol';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { ExtHostCredentialManagement } from 'sql/workbench/api/node/extHostCredentialManagement';
import { SqlMainContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IRPCProtocol } from 'vs/workbench/services/extensions/node/proxyIdentifier';
import { MainThreadCredentialManagement } from 'sql/workbench/api/node/mainThreadCredentialManagement';
import { CredentialsTestProvider, CredentialsTestService } from 'sqltest/stubs/credentialsTestStubs';
import { ICredentialsService } from 'sql/platform/credentials/common/credentialsService';
import { Credential, CredentialProvider } from 'sqlops';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

const IRPCProtocol = createDecorator<IRPCProtocol>('rpcProtocol');

// SUITE STATE /////////////////////////////////////////////////////////////
let credentialServiceStub: CredentialsTestService;
let instantiationService: TestInstantiationService;
let threadService: TestRPCProtocol;

// TESTS ///////////////////////////////////////////////////////////////////
suite('ExtHostCredentialManagement', () => {
	suiteSetup(() => {
		threadService = new TestRPCProtocol();
		credentialServiceStub = new CredentialsTestService();

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
		let mockCredentialProvider = new CredentialsTestProvider();

		// If: I register the credential provider with the extension host
		extHost.$registerCredentialProvider(mockCredentialProvider);

		// Then: There should be one provider registered
		assert.equal(extHost.getProviderCount(), 1);
	});

	test('Get Credential Provider - Success', (done) => {
		// Setup: Register a mock credential provider
		let extHost = new ExtHostCredentialManagement(threadService);
		let mockCredentialProvider = new CredentialsTestProvider();
		extHost.$registerCredentialProvider(mockCredentialProvider);

		// If: I get the credential provider
		let namespaceId = 'test_namespace';
		let credentialId = 'test_id';
		let credential = 'test_credential';
		let expectedCredentialId = `${namespaceId}|${credentialId}`;
		let credProvider: CredentialProvider;
		extHost.$getCredentialProvider(namespaceId)
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
			})
			.then(() => done(), (err) => done(err));
	});

	test('Get Credential Provider - No Namespace', (done) => {
		// Setup: Register a mock credential provider
		let extHost = new ExtHostCredentialManagement(threadService);
		let mockCredentialProvider = new CredentialsTestProvider();
		extHost.$registerCredentialProvider(mockCredentialProvider);

		// If: I get a credential provider with an invalid namespace ID
		// Then: I should get an error
		extHost.$getCredentialProvider(undefined)
			.then(
			() => { done('Provider was returned from undefined'); },
			() => { /* Swallow error, this is success path */ }
			)
			.then(() => { return extHost.$getCredentialProvider(null); })
			.then(
			() => { done('Provider was returned from null'); },
			() => { /* Swallow error, this is success path */ }
			)
			.then(() => { return extHost.$getCredentialProvider(''); })
			.then(
			() => { done('Provider was returned from \'\''); },
			() => { done(); }
			);
	});
});
