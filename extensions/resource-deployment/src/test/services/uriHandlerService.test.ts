/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as TypeMoq from 'typemoq';
import { ResourceTypeService } from '../../services/resourceTypeService';
import { UriHandlerService } from '../../services/uriHandlerService';
import { ResourceType } from '../../interfaces';

const resourceType1Name = 'resource-type-1';

const mockResourceTypes: ResourceType[] = [
	{
		name: resourceType1Name,
		displayName: 'Resource Type 1',
		description: '',
		platforms: '*',
		icon: '',
		options: [],
		providers: [],
		helpTexts: [],
		getOkButtonText: (selectedOptions: { option: string, value: string }[]) => undefined,
		getProvider: (selectedOptions: { option: string, value: string }[]) => undefined,
		getAgreementInfo: (selectedOptions: { option: string, value: string }[]) => undefined,
		getHelpText: (selectedOption: { option: string, value: string }[]) => undefined
	}
];

describe('uriHandlerService Tests', function (): void {

	afterEach(function (): void {
		sinon.restore();
	});

	const resourceTypeServiceMock = TypeMoq.Mock.ofType<ResourceTypeService>();
	resourceTypeServiceMock.setup(x => x.getResourceTypes()).returns(() => {
		return mockResourceTypes;
	});
	const uriHandlerService = new UriHandlerService(resourceTypeServiceMock.object);

	it('unknown path is ignored', async function (): Promise<void> {
		const uri = vscode.Uri.parse('azuredatastudio://Microsoft.resource-deployment/badPath');
		await uriHandlerService.handleUri(uri);
	});

	describe('deploy path', function (): void {
		it('no parameters', async function (): Promise<void> {
			const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
			const uri = vscode.Uri.parse('azuredatastudio://Microsoft.resource-deployment/deploy');
			await uriHandlerService.handleUri(uri);
			sinon.assert.calledOnce(executeCommandStub);
		});

		it('unknown type', async function (): Promise<void> {
			const executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
			const uri = vscode.Uri.parse('azuredatastudio://Microsoft.resource-deployment/deploy?type=unknown-type');
			await uriHandlerService.handleUri(uri);
			sinon.assert.calledOnce(executeCommandStub);
		});

		it('with type only', async function (): Promise<void> {
			const uri = vscode.Uri.parse(`azuredatastudio://Microsoft.resource-deployment/deploy?type=${resourceType1Name}`);
			await uriHandlerService.handleUri(uri);
			resourceTypeServiceMock.verify(x => x.startDeployment(TypeMoq.It.isObjectWith(mockResourceTypes[0]), undefined, TypeMoq.It.isObjectWith({})), TypeMoq.Times.once());
		});

		it('with parameters', async function (): Promise<void> {
			const params = { 'param1': 'value1', 'param2': 'value2' };
			const uri = vscode.Uri.parse(`azuredatastudio://Microsoft.resource-deployment/deploy?type=${resourceType1Name}&params=${encodeURIComponent(JSON.stringify(params))}`);
			await uriHandlerService.handleUri(uri);
			resourceTypeServiceMock.verify(x => x.startDeployment(TypeMoq.It.isObjectWith(mockResourceTypes[0]), undefined, TypeMoq.It.isObjectWith(params)), TypeMoq.Times.once());
		});
	});
});
