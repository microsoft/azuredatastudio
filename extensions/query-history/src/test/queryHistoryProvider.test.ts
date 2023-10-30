/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as should from 'should';
import 'mocha';
import * as sinon from 'sinon';
import * as azdataTest from '@microsoft/azdata-test';
import { QueryHistoryProvider } from '../queryHistoryProvider';
import { QueryHistoryItem } from '../queryHistoryItem';

describe('QueryHistoryProvider', () => {

	let testProvider: QueryHistoryProvider;
	let testListener: azdata.queryeditor.QueryEventListener;
	let textDocumentSandbox: sinon.SinonSandbox;
	const testUri = vscode.Uri.parse('untitled://query1');

	beforeEach(async function (): Promise<void> {
		sinon.stub(azdata.queryeditor, 'registerQueryEventListener').callsFake((listener: azdata.queryeditor.QueryEventListener) => {
			testListener = listener;
			return { dispose: (): void => { } };
		});
		textDocumentSandbox = sinon.createSandbox();
		textDocumentSandbox.replaceGetter(vscode.workspace, 'textDocuments', () => [azdataTest.mocks.vscode.createTextDocumentMock(testUri).object]);
		const getConnectionStub = sinon.stub(azdata.connection, 'getConnection');
		getConnectionStub.resolves(<any>{});
		const contextMock = azdataTest.mocks.vscode.createExtensionContextMock();
		testProvider = new QueryHistoryProvider(contextMock.object, contextMock.object.globalStorageUri);
		// Disable persistence during tests
		await testProvider.setPersistenceEnabled(false);
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('There should be no children initially', async function () {
		const children = await testProvider.getChildren();
		should(children).length(0);
	});

	it('Clearing empty list does not throw', async function () {
		await testProvider.clearAll();
		const children = await testProvider.getChildren();
		should(children).length(0);
	});

	it('non-queryStop events don\'t cause children to be added', async function () {
		const types: azdata.queryeditor.QueryEventType[] = ['executionPlan', 'queryStart', 'queryUpdate', 'visualize'];
		for (const type of types) {
			await fireQueryEventAndWaitForRefresh(type, <any>{ uri: testUri.toString() }, { messages: [], batchRanges: [] }, 2000);
			const children = await testProvider.getChildren();
			should(children).length(0, `Should have no children after ${type} event`);
		}
	});

	it('queryStop events cause children to be added', async function () {
		setupTextEditorMock('SELECT 1');
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		const children = await testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');

		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		should(children).length(2, 'Should have two children after adding another item');
	});

	it('no selection records entire text', async function () {
		const content = 'SELECT 1\nSELECT 2';
		setupTextEditorMock(content);
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		const children = await testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');
		should(children[0].queryText).be.equal(content, 'item content should be full text content');
	});

	it('active selection records only selected text', async function () {
		const rangeWithContent1: azdataTest.mocks.vscode.RangeWithContent = { range: new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2, 0)), content: 'SELECT 1' };
		const rangeWithContent2: azdataTest.mocks.vscode.RangeWithContent = { range: new vscode.Range(new vscode.Position(3, 0), new vscode.Position(3, 5)), content: 'SELECT 2' };
		setupTextEditorMock([rangeWithContent1, rangeWithContent2], [new vscode.Selection(rangeWithContent1.range.start, rangeWithContent1.range.end)]);
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		const children = await testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');
		should(children[0].queryText).be.equal(rangeWithContent1.content, 'item content should be only active selection');
	});

	it('event with errors is marked as error', async function () {
		setupTextEditorMock('SELECT 1');
		const message1: azdata.queryeditor.QueryMessage = { message: 'Message 1', isError: false };
		const message2: azdata.queryeditor.QueryMessage = { message: 'Error message', isError: true };
		const message3: azdata.queryeditor.QueryMessage = { message: 'Message 2', isError: false };
		await fireQueryStartAndStopAndWaitForRefresh(testUri, { messages: [message1, message2, message3], batchRanges: [] });
		const children = await testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');
		should(children[0].isSuccess).be.false('Event with errors should have error icon');
	});

	it('event without errors is marked as success', async function () {
		setupTextEditorMock('SELECT 1');
		const message1: azdata.queryeditor.QueryMessage = { message: 'Message 1', isError: false };
		const message2: azdata.queryeditor.QueryMessage = { message: 'Message 2', isError: false };
		const message3: azdata.queryeditor.QueryMessage = { message: 'Message 3', isError: false };
		await fireQueryStartAndStopAndWaitForRefresh(testUri, { messages: [message1, message2, message3], batchRanges: [] });
		const children = await testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');
		should(children[0].isSuccess).be.true('Event without errors should have check icon');
	});

	it('queryStop events from unknown document are ignored', async function () {
		const unknownUri = vscode.Uri.parse('untitled://query2');
		const queryDocumentMock = azdataTest.mocks.azdata.queryeditor.createQueryDocumentMock(unknownUri.toString());
		// Since we didn't find the text document we'll never update the item list so add a timeout since that event will never fire
		await fireQueryEventAndWaitForRefresh('queryStop', queryDocumentMock.object, { messages: [], batchRanges: [] }, 2000);
		const children = await testProvider.getChildren();
		should(children).length(0, 'Should not have any children');
	});

	it('can clear all with one child', async function () {
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		let children = await testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding item');

		await waitForItemRefresh(() => testProvider.clearAll());
		children = await testProvider.getChildren();
		should(children).length(0, 'Should have no children after clearing');
	});

	it('can clear all with multiple children', async function () {
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		let children = await testProvider.getChildren();
		should(children).length(3, 'Should have 3 children after adding item');

		await waitForItemRefresh(() => testProvider.clearAll());
		children = await testProvider.getChildren();
		should(children).length(0, 'Should have no children after clearing');
	});

	it('delete item when no items doesn\'t throw', async function () {
		const testItem: QueryHistoryItem = { queryText: 'SELECT 1', connectionProfile: azdataTest.stubs.azdata.createConnectionProfile(), timestamp: new Date().toLocaleString(), isSuccess: true };
		await waitForItemRefresh(() => testProvider.deleteItem(testItem));
		const children = await testProvider.getChildren();
		should(children).length(0, 'Should have no children after deleting item');
	});

	it('delete item that doesn\'t exist doesn\'t throw', async function () {
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		let children = await testProvider.getChildren();
		should(children).length(1, 'Should have 1 child initially');

		const testItem: QueryHistoryItem = { queryText: 'SELECT 1', connectionProfile: azdataTest.stubs.azdata.createConnectionProfile(), timestamp: new Date().toLocaleString(), isSuccess: true };
		await waitForItemRefresh(() => testProvider.deleteItem(testItem));
		children = await testProvider.getChildren();
		should(children).length(1, 'Should still have 1 child after deleting item');
	});

	it('can delete single item', async function () {
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		const firstChildren = await testProvider.getChildren();
		should(firstChildren).length(3, 'Should have 3 children initially');

		let itemToDelete: QueryHistoryItem = firstChildren[1];
		await waitForItemRefresh(() => testProvider.deleteItem(itemToDelete));
		const secondChildren = await testProvider.getChildren();
		should(secondChildren).length(2, 'Should still have 2 child after deleting item');
		should(secondChildren[0]).be.equal(firstChildren[0], 'First item should still exist after deleting first item');
		should(secondChildren[1]).be.equal(firstChildren[2], 'Second item should still exist after deleting first item');

		itemToDelete = secondChildren[0];
		await waitForItemRefresh(() => testProvider.deleteItem(itemToDelete));
		const thirdChildren = await testProvider.getChildren();
		should(thirdChildren).length(1, 'Should still have 1 child after deleting item');
		should(thirdChildren[0]).be.equal(secondChildren[1], 'Second item should still exist after deleting second item');

		itemToDelete = thirdChildren[0];
		await waitForItemRefresh(() => testProvider.deleteItem(itemToDelete));
		const fourthChildren = await testProvider.getChildren();
		should(fourthChildren).length(0, 'Should have no children after deleting all items');
	});

	it('pausing capture causes children not to be added', async function () {
		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		const children = await testProvider.getChildren();
		should(children).length(1, 'Should have one child after adding initial item');

		await testProvider.setCaptureEnabled(false);

		// Add timeout since the item is never added, thus never triggering the event
		await fireQueryStartAndStopAndWaitForRefresh(testUri, { messages: [], batchRanges: [] }, 2000);
		should(children).length(1, 'Should still have 1 child after adding item when capture paused');

		await testProvider.setCaptureEnabled(true);

		await fireQueryStartAndStopAndWaitForRefresh(testUri);
		should(children).length(2, 'Should have 2 child after adding item when capture was resumed');
	});

	function setupTextEditorMock(content: string | azdataTest.mocks.vscode.RangeWithContent[], selections?: vscode.Selection[] | undefined): void {
		const textDocumentMock = azdataTest.mocks.vscode.createTextDocumentMock(testUri, content);
		const textEditorMock = azdataTest.mocks.vscode.createTextEditorMock(textDocumentMock.object, selections);
		textDocumentSandbox.replaceGetter(vscode.window, 'activeTextEditor', () => textEditorMock.object);
	}

	async function fireQueryStartAndStopAndWaitForRefresh(uri: vscode.Uri, queryInfo: azdata.queryeditor.QueryInfo = { messages: [], batchRanges: [] }, timeoutMs?: number): Promise<void> {
		const queryDocumentMock = azdataTest.mocks.azdata.queryeditor.createQueryDocumentMock(uri.toString());
		// First queryStart message to record text. QueryInfo is always empty for this.
		testListener.onQueryEvent('queryStart', queryDocumentMock.object, undefined, { messages: [], batchRanges: [] });
		// Fire queryStop message to trigger creation of the history node
		await fireQueryEventAndWaitForRefresh('queryStop', queryDocumentMock.object, queryInfo, timeoutMs);
	}

	async function fireQueryEventAndWaitForRefresh(type: azdata.queryeditor.QueryEventType, document: azdata.queryeditor.QueryDocument, queryInfo: azdata.queryeditor.QueryInfo, timeoutMs?: number): Promise<void> {
		await waitForItemRefresh(async () => testListener.onQueryEvent(type, document, undefined, queryInfo), timeoutMs);
	}

	async function waitForItemRefresh(func: () => Promise<void>, timeoutMs?: number): Promise<void> {
		const promises: Promise<any>[] = [azdataTest.helpers.eventToPromise(testProvider.onDidChangeTreeData)];
		const timeoutPromise = timeoutMs ? new Promise<void>(r => setTimeout(() => r(), timeoutMs)) : undefined;
		if (timeoutPromise) {
			promises.push(timeoutPromise);
		}
		await func();
		await Promise.race(promises);
	}
});


