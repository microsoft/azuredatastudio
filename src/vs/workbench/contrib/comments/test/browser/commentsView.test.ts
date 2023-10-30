/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { IRange, Range } from 'vs/editor/common/core/range';
import { CommentsPanel } from 'vs/workbench/contrib/comments/browser/commentsView';
import { CommentService, ICommentService } from 'vs/workbench/contrib/comments/browser/commentService';
import { Comment, CommentInput, CommentThread, CommentThreadCollapsibleState, CommentThreadState } from 'vs/editor/common/languages';
import { Emitter, Event } from 'vs/base/common/event';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IViewContainerModel, IViewDescriptor, IViewDescriptorService, ViewContainer, ViewContainerLocation } from 'vs/workbench/common/views';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { DisposableStore } from 'vs/base/common/lifecycle';

class TestCommentThread implements CommentThread<IRange> {
	isDocumentCommentThread(): this is CommentThread<IRange> {
		return true;
	}
	constructor(public readonly commentThreadHandle: number,
		public readonly controllerHandle: number,
		public readonly threadId: string,
		public readonly resource: string,
		public readonly range: IRange,
		public readonly comments: Comment[]) { }

	onDidChangeComments: Event<readonly Comment[] | undefined> = new Emitter<readonly Comment[] | undefined>().event;
	onDidChangeInitialCollapsibleState: Event<CommentThreadCollapsibleState | undefined> = new Emitter<CommentThreadCollapsibleState | undefined>().event;
	canReply: boolean = false;
	onDidChangeInput: Event<CommentInput | undefined> = new Emitter<CommentInput | undefined>().event;
	onDidChangeRange: Event<IRange> = new Emitter<IRange>().event;
	onDidChangeLabel: Event<string | undefined> = new Emitter<string | undefined>().event;
	onDidChangeCollapsibleState: Event<CommentThreadCollapsibleState | undefined> = new Emitter<CommentThreadCollapsibleState | undefined>().event;
	onDidChangeState: Event<CommentThreadState | undefined> = new Emitter<CommentThreadState | undefined>().event;
	onDidChangeCanReply: Event<boolean> = new Emitter<boolean>().event;
	isDisposed: boolean = false;
	isTemplate: boolean = false;
	label: string | undefined = undefined;
	contextValue: string | undefined = undefined;
}

export class TestViewDescriptorService implements Partial<IViewDescriptorService> {
	getViewLocationById(id: string): ViewContainerLocation | null {
		return ViewContainerLocation.Panel;
	}
	readonly onDidChangeLocation: Event<{ views: IViewDescriptor[]; from: ViewContainerLocation; to: ViewContainerLocation }> = new Emitter<{ views: IViewDescriptor[]; from: ViewContainerLocation; to: ViewContainerLocation }>().event;
	getViewDescriptorById(id: string): IViewDescriptor | null {
		return null;
	}
	getViewContainerByViewId(id: string): ViewContainer | null {
		return {
			id: 'comments',
			title: 'Comments',
			ctorDescriptor: {} as any
		};
	}
	getViewContainerModel(viewContainer: ViewContainer): IViewContainerModel {
		const partialViewContainerModel: Partial<IViewContainerModel> = {
			onDidChangeContainerInfo: new Emitter<{ title?: boolean; icon?: boolean; keybindingId?: boolean }>().event
		};
		return partialViewContainerModel as IViewContainerModel;
	}
	getDefaultContainerById(id: string): ViewContainer | null {
		return null;
	}
}

suite('Comments View', function () {

	let disposables: DisposableStore;
	let instantiationService: TestInstantiationService;
	let commentService: CommentService;

	setup(() => {
		disposables = new DisposableStore();
		instantiationService = workbenchInstantiationService({}, disposables);
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		instantiationService.stub(IContextViewService, {});
		instantiationService.stub(IViewDescriptorService, new TestViewDescriptorService());
		commentService = instantiationService.createInstance(CommentService);
		instantiationService.stub(ICommentService, commentService);
	});

	teardown(() => {
		commentService.dispose();
		disposables.dispose();
	});

	test('collapse all', async function () {
		const view = instantiationService.createInstance(CommentsPanel, { id: 'comments', title: 'Comments' });
		view.render();
		commentService.setWorkspaceComments('test', [
			new TestCommentThread(1, 1, '1', 'test1', new Range(1, 1, 1, 1), [{ body: 'test', uniqueIdInThread: 1, userName: 'alex' }]),
			new TestCommentThread(2, 1, '1', 'test2', new Range(1, 1, 1, 1), [{ body: 'test', uniqueIdInThread: 1, userName: 'alex' }]),
		]);
		assert.strictEqual(view.getFilterStats().total, 2);
		assert.strictEqual(view.areAllCommentsExpanded(), true);
		view.collapseAll();
		assert.strictEqual(view.isSomeCommentsExpanded(), false);
		view.dispose();
	});

	test('expand all', async function () {
		const view = instantiationService.createInstance(CommentsPanel, { id: 'comments', title: 'Comments' });
		view.render();
		commentService.setWorkspaceComments('test', [
			new TestCommentThread(1, 1, '1', 'test1', new Range(1, 1, 1, 1), [{ body: 'test', uniqueIdInThread: 1, userName: 'alex' }]),
			new TestCommentThread(2, 1, '1', 'test2', new Range(1, 1, 1, 1), [{ body: 'test', uniqueIdInThread: 1, userName: 'alex' }]),
		]);
		assert.strictEqual(view.getFilterStats().total, 2);
		view.collapseAll();
		assert.strictEqual(view.isSomeCommentsExpanded(), false);
		view.expandAll();
		assert.strictEqual(view.areAllCommentsExpanded(), true);
		view.dispose();
	});

	test('filter by text', async function () {
		const view = instantiationService.createInstance(CommentsPanel, { id: 'comments', title: 'Comments' });
		view.setVisible(true);
		view.render();
		commentService.setWorkspaceComments('test', [
			new TestCommentThread(1, 1, '1', 'test1', new Range(1, 1, 1, 1), [{ body: 'This comment is a cat.', uniqueIdInThread: 1, userName: 'alex' }]),
			new TestCommentThread(2, 1, '1', 'test2', new Range(1, 1, 1, 1), [{ body: 'This comment is a dog.', uniqueIdInThread: 1, userName: 'alex' }]),
		]);
		assert.strictEqual(view.getFilterStats().total, 2);
		assert.strictEqual(view.getFilterStats().filtered, 2);
		view.getFilterWidget().setFilterText('cat');
		// Setting showResolved causes the filter to trigger for the purposes of this test.
		view.filters.showResolved = false;

		assert.strictEqual(view.getFilterStats().total, 2);
		assert.strictEqual(view.getFilterStats().filtered, 1);
		view.clearFilterText();
		// Setting showResolved causes the filter to trigger for the purposes of this test.
		view.filters.showResolved = true;
		assert.strictEqual(view.getFilterStats().total, 2);
		assert.strictEqual(view.getFilterStats().filtered, 2);
		view.dispose();
	});
});
