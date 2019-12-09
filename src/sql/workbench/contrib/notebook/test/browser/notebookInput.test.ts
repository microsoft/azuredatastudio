/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as assert from 'assert';
import { nb } from 'azdata';
import { workbenchInstantiationService } from 'vs/workbench/test/workbenchTestServices';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/common/models/untitledNotebookInput';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/common/models/fileNotebookInput';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { UntitledTextEditorModel } from 'vs/workbench/common/editor/untitledTextEditorModel';

suite('Notebook Input', function (): void {
	const instantiationService = workbenchInstantiationService();

	test('File Notebook Input', async function (): Promise<void> {
		let uri = URI.from({ scheme: Schemas.file, path: 'TestPath' });
		let input = instantiationService.createInstance(FileNotebookInput, 'TestInput', uri, undefined);

		let inputId = input.getTypeId();
		assert.strictEqual(inputId, FileNotebookInput.ID);
	});

	test('Untitled Notebook Input', async function (): Promise<void> {
		let uri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });
		let input = instantiationService.createInstance(UntitledNotebookInput, 'TestInput', uri, undefined);

		let inputId = input.getTypeId();
		assert.strictEqual(inputId, UntitledNotebookInput.ID);
	});

	test('Getters and Setters', async function (): Promise<void> {
		let testUri = URI.from({ scheme: Schemas.untitled, path: 'TestPath' });
		let input = instantiationService.createInstance(UntitledNotebookInput, 'TestInput', testUri, undefined);

		// Text Input
		assert.strictEqual(input.textInput, undefined);

		// Notebook URI
		assert.deepStrictEqual(input.notebookUri, testUri);

		// Content Manager
		assert.ok(input.contentManager !== undefined);

		// Connection Profile
		let testProfile = <IConnectionProfile>{};
		input.connectionProfile = testProfile;
		assert.strictEqual(input.connectionProfile, testProfile);

		// Default Kernel
		let testKernel: nb.IKernelSpec = {
			name: 'TestName',
			language: 'TestLanguage',
			display_name: 'TestDisplayName'
		};
		input.defaultKernel = testKernel;
		assert.strictEqual(input.defaultKernel, testKernel);

		// Untitled Editor Model
		let testModel = <UntitledTextEditorModel>{};
		input.untitledEditorModel = testModel;
		assert.strictEqual(input.untitledEditorModel, testModel);

		// getResource
		assert.strictEqual(input.getResource(), testUri);

		// Container
		let testContainer = undefined;
		input.container = testContainer;
		assert.strictEqual(input.container, testContainer);

		let mockParentNode = TypeMoq.Mock.ofType<Node>(NodeStub);
		mockParentNode.setup(e => e.removeChild(TypeMoq.It.isAny()));
		testContainer = <HTMLElement>{ parentNode: mockParentNode.object };
		input.container = testContainer;
		assert.strictEqual(input.container, testContainer);
		mockParentNode.verify(e => e.removeChild(TypeMoq.It.isAny()), TypeMoq.Times.once());
	});
});

class NodeStub implements Node {
	baseURI: string;
	childNodes: NodeListOf<ChildNode>;
	firstChild: ChildNode;
	isConnected: boolean;
	lastChild: ChildNode;
	namespaceURI: string;
	nextSibling: ChildNode;
	nodeName: string;
	nodeType: number;
	nodeValue: string;
	ownerDocument: Document;
	parentElement: HTMLElement;
	parentNode: Node & ParentNode;
	previousSibling: Node;
	textContent: string;
	appendChild<T extends Node>(newChild: T): T {
		throw new Error('Method not implemented.');
	}
	cloneNode(deep?: boolean): Node {
		throw new Error('Method not implemented.');
	}
	compareDocumentPosition(other: Node): number {
		throw new Error('Method not implemented.');
	}
	contains(other: Node): boolean {
		throw new Error('Method not implemented.');
	}
	getRootNode(options?: GetRootNodeOptions): Node {
		throw new Error('Method not implemented.');
	}
	hasChildNodes(): boolean {
		throw new Error('Method not implemented.');
	}
	insertBefore<T extends Node>(newChild: T, refChild: Node): T {
		throw new Error('Method not implemented.');
	}
	isDefaultNamespace(namespace: string): boolean {
		throw new Error('Method not implemented.');
	}
	isEqualNode(otherNode: Node): boolean {
		throw new Error('Method not implemented.');
	}
	isSameNode(otherNode: Node): boolean {
		throw new Error('Method not implemented.');
	}
	lookupNamespaceURI(prefix: string): string {
		throw new Error('Method not implemented.');
	}
	lookupPrefix(namespace: string): string {
		throw new Error('Method not implemented.');
	}
	normalize(): void {
		throw new Error('Method not implemented.');
	}
	removeChild<T extends Node>(oldChild: T): T {
		throw new Error('Method not implemented.');
	}
	replaceChild<T extends Node>(newChild: Node, oldChild: T): T {
		throw new Error('Method not implemented.');
	}
	ATTRIBUTE_NODE: number;
	CDATA_SECTION_NODE: number;
	COMMENT_NODE: number;
	DOCUMENT_FRAGMENT_NODE: number;
	DOCUMENT_NODE: number;
	DOCUMENT_POSITION_CONTAINED_BY: number;
	DOCUMENT_POSITION_CONTAINS: number;
	DOCUMENT_POSITION_DISCONNECTED: number;
	DOCUMENT_POSITION_FOLLOWING: number;
	DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC: number;
	DOCUMENT_POSITION_PRECEDING: number;
	DOCUMENT_TYPE_NODE: number;
	ELEMENT_NODE: number;
	ENTITY_NODE: number;
	ENTITY_REFERENCE_NODE: number;
	NOTATION_NODE: number;
	PROCESSING_INSTRUCTION_NODE: number;
	TEXT_NODE: number;
	addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
		throw new Error('Method not implemented.');
	}
	dispatchEvent(event: Event): boolean {
		throw new Error('Method not implemented.');
	}
	removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void {
		throw new Error('Method not implemented.');
	}
}
