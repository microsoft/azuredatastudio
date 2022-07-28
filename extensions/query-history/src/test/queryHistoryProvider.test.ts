/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as should from 'should';
import 'mocha';
import * as sinon from 'sinon';
import * as azdataTest from '@microsoft/azdata-test';
import { QueryHistoryProvider } from '../queryHistoryProvider';
import { QueryHistoryItem } from '../queryHistoryItem';
import { EOL } from 'os';

describe('QueryHistoryProvider', () => {

	let testProvider: QueryHistoryProvider;
	let testListener: azdata.queryeditor.QueryEventListener;
	let textDocumentSandbox: sinon.SinonSandbox;
	const testUri = vscode.Uri.parse('untitled://query1');

	beforeEach(function (): void {
		sinon.stub(azdata.queryeditor, 'registerQueryEventListener').callsFake((listener: azdata.queryeditor.QueryEventListener) => {
			testListener = listener;
			return { dispose: (): void => { } };
		});
		textDocumentSandbox = sinon.createSandbox();
		textDocumentSandbox.replaceGetter(vscode.workspace, 'textDocuments', () => [azdataTest.mocks.vscode.createTextDocumentMock(testUri).object]);
		const getConnectionStub = sinon.stub(azdata.connection, 'getConnection');
		getConnectionStub.resolves(<any>{});
		testProvider = new QueryHistoryProvider();
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('There should be no children initially', function () {
		const children = testProvider.getChildren();
		should(children).length(0);
	});

	it('Clearing empty list does not throw', function () {
		testProvider.clearAll();
		const children = testProvider.getChildren();
		should(children).length(0);
	});

	it('non-queryStop events don\'t cause children to be added', async function () {
		const types: azdata.queryeditor.QueryEventType[] = ['executionPlan', 'queryStart', 'queryUpdate', 'visualize'];
		for (const type of types) {
			await fireQueryEventAndWaitForRefresh(type, <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] }, 2000);
			const children = testProvider.getChildren();
			should(children).length(0, `Should have no children after ${type} event`);
		}
	});

	it('queryStop events cause children to be added', async function () {
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		const children = testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');

		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		should(children).length(2, 'Should have two children after adding another item');
	});

	it('multiple ranges are combined', async function () {
		const rangeWithContent1: azdataTest.mocks.vscode.RangeWithContent = { range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2, 0)), content: 'SELECT 1' };
		const rangeWithContent2: azdataTest.mocks.vscode.RangeWithContent = { range: new vscode.Range(new vscode.Position(3, 0), new vscode.Position(3, 5)), content: 'SELECT 2' };
		const textDocumentMock = azdataTest.mocks.vscode.createTextDocumentMock(testUri, [rangeWithContent1, rangeWithContent2]);
		textDocumentSandbox.restore();
		textDocumentSandbox.replaceGetter(vscode.workspace, 'textDocuments', () => [textDocumentMock.object]);
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, {
			messages: [],
			batchRanges: [rangeWithContent1.range, rangeWithContent2.range]
		});
		const children = testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');
		should(children[0].queryText).be.equal(`${rangeWithContent1.content}${EOL}${rangeWithContent2.content}`, 'item content should be combined from both source ranges');
	});

	it('event with errors is marked as error', async function () {
		const message1: azdata.queryeditor.QueryMessage = { message: 'Message 1', isError: false };
		const message2: azdata.queryeditor.QueryMessage = { message: 'Error message', isError: true };
		const message3: azdata.queryeditor.QueryMessage = { message: 'Message 2', isError: false };
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [ message1, message2, message3 ], batchRanges: []});
		const children = testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');
		should(children[0].isSuccess).be.false('Event with errors should have error icon');
	});

	it('event without errors is marked as success', async function () {
		const message1: azdata.queryeditor.QueryMessage = { message: 'Message 1', isError: false };
		const message2: azdata.queryeditor.QueryMessage = { message: 'Message 2', isError: false };
		const message3: azdata.queryeditor.QueryMessage = { message: 'Message 3', isError: false };
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [ message1, message2, message3 ], batchRanges: []});
		const children = testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');
		should(children[0].isSuccess).be.true('Event without errors should have check icon');
	});

	it('queryStop events from unknown document are ignored', async function () {
		const unknownUri = vscode.Uri.parse('untitled://query2');
		// Since we didn't find the text document we'll never update the item list so add a timeout since that event will never fire
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: unknownUri.toString() }, { messages: [], batchRanges: [] }, 2000);
		const children = testProvider.getChildren();
		should(children).length(0, 'Should not have any children');
	});

	it('can clear all with one child', async function () {
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		let children = testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');

		await waitForItemRefresh(() => testProvider.clearAll());
		children = testProvider.getChildren();
		should(children).length(0, 'Should have no children after clearing');
	});

	it('can clear all with multiple children', async function () {
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		let children = testProvider.getChildren();
		should(children).length(3, 'Should have 3 children after adding item');

		await waitForItemRefresh(() => testProvider.clearAll());
		children = testProvider.getChildren();
		should(children).length(0, 'Should have no children after clearing');
	});

	it('delete item when no items doesn\'t throw', async function () {
		const testItem: QueryHistoryItem = { queryText: 'SELECT 1', connectionProfile: azdataTest.stubs.connectionProfile.createConnectionProfile(), timestamp: new Date(), isSuccess: true };
		await waitForItemRefresh(() => testProvider.deleteItem(testItem));
		const children = testProvider.getChildren();
		should(children).length(0, 'Should have no children after deleting item');
	});

	it('delete item that doesn\'t exist doesn\'t throw', async function () {
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		let children = testProvider.getChildren();
		should(children).length(1, 'Should have 1 child initially');

		const testItem: QueryHistoryItem = { queryText: 'SELECT 1', connectionProfile: azdataTest.stubs.connectionProfile.createConnectionProfile(), timestamp: new Date(), isSuccess: true };
		await waitForItemRefresh(() => testProvider.deleteItem(testItem));
		children = testProvider.getChildren();
		should(children).length(1, 'Should still have 1 child after deleting item');
	});

	it('can delete single item', async function () {
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		const firstChildren = testProvider.getChildren();
		should(firstChildren).length(3, 'Should have 3 children initially');

		let itemToDelete: QueryHistoryItem = firstChildren[1];
		await waitForItemRefresh(() => testProvider.deleteItem(itemToDelete));
		const secondChildren = testProvider.getChildren();
		should(secondChildren).length(2, 'Should still have 2 child after deleting item');
		should(secondChildren[0]).be.equal(firstChildren[0], 'First item should still exist after deleting first item');
		should(secondChildren[1]).be.equal(firstChildren[2], 'Second item should still exist after deleting first item');

		itemToDelete = secondChildren[0];
		await waitForItemRefresh(() => testProvider.deleteItem(itemToDelete));
		const thirdChildren = testProvider.getChildren();
		should(thirdChildren).length(1, 'Should still have 1 child after deleting item');
		should(thirdChildren[0]).be.equal(secondChildren[1], 'Second item should still exist after deleting second item');

		itemToDelete = thirdChildren[0];
		await waitForItemRefresh(() => testProvider.deleteItem(itemToDelete));
		const fourthChildren = testProvider.getChildren();
		should(fourthChildren).length(0, 'Should have no children after deleting all items');
	});

	it('pausing capture causes children not to be added', async function () {
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		const children = testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding initial item');

		await testProvider.setCaptureEnabled(false);

		// Add timeout since the item is never added, thus never triggering the event
		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] }, 2000);
		should(children).length(1, 'Should still have 1 child after adding item when capture paused');

		await testProvider.setCaptureEnabled(true);

		await fireQueryEventAndWaitForRefresh('queryStop', <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] });
		should(children).length(2, 'Should have 2 child after adding item when capture was resumed');
	});

	async function fireQueryEventAndWaitForRefresh(type: azdata.queryeditor.QueryEventType, document: azdata.queryeditor.QueryDocument, queryInfo: azdata.queryeditor.QueryInfo, timeoutMs?: number): Promise<void> {
		await waitForItemRefresh(() => testListener.onQueryEvent(type, document, undefined, queryInfo), timeoutMs);
	}

	async function waitForItemRefresh(func: Function, timeoutMs?: number): Promise<void> {
		const promises: Promise<any>[] = [azdataTest.helpers.eventToPromise(testProvider.onDidChangeTreeData)];
		const timeoutPromise = timeoutMs ? new Promise<void>(r => setTimeout(() => r(), timeoutMs)) : undefined;
		if (timeoutPromise) {
			promises.push(timeoutPromise);
		}
		func();
		await Promise.race(promises);
	}
});


