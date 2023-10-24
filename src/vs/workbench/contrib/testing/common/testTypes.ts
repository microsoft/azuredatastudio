/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMarkdownString } from 'vs/base/common/htmlContent';
import { MarshalledId } from 'vs/base/common/marshallingIds';
import { URI, UriComponents } from 'vs/base/common/uri';
import { IPosition } from 'vs/editor/common/core/position';
import { IRange, Range } from 'vs/editor/common/core/range';
import { TestId } from 'vs/workbench/contrib/testing/common/testId';

export const enum TestResultState {
	Unset = 0,
	Queued = 1,
	Running = 2,
	Passed = 3,
	Failed = 4,
	Skipped = 5,
	Errored = 6
}

/** note: keep in sync with TestRunProfileKind in vscode.d.ts */
export const enum ExtTestRunProfileKind {
	Run = 1,
	Debug = 2,
	Coverage = 3,
}

export const enum TestRunProfileBitset {
	Run = 1 << 1,
	Debug = 1 << 2,
	Coverage = 1 << 3,
	HasNonDefaultProfile = 1 << 4,
	HasConfigurable = 1 << 5,
	SupportsContinuousRun = 1 << 6,
}

/**
 * List of all test run profile bitset values.
 */
export const testRunProfileBitsetList = [
	TestRunProfileBitset.Run,
	TestRunProfileBitset.Debug,
	TestRunProfileBitset.Coverage,
	TestRunProfileBitset.HasNonDefaultProfile,
	TestRunProfileBitset.HasConfigurable,
	TestRunProfileBitset.SupportsContinuousRun,
];

/**
 * DTO for a controller's run profiles.
 */
export interface ITestRunProfile {
	controllerId: string;
	profileId: number;
	label: string;
	group: TestRunProfileBitset;
	isDefault: boolean;
	tag: string | null;
	hasConfigurationHandler: boolean;
	supportsContinuousRun: boolean;
}

/**
 * A fully-resolved request to run tests, passsed between the main thread
 * and extension host.
 */
export interface ResolvedTestRunRequest {
	targets: {
		testIds: string[];
		controllerId: string;
		profileGroup: TestRunProfileBitset;
		profileId: number;
	}[];
	exclude?: string[];
	/** Whether this is a continuous test run */
	continuous?: boolean;
	/** Whether this was trigged by a user action in UI. Default=true */
	isUiTriggered?: boolean;
}

/**
 * Request to the main thread to run a set of tests.
 */
export interface ExtensionRunTestsRequest {
	id: string;
	include: string[];
	exclude: string[];
	controllerId: string;
	profile?: { group: TestRunProfileBitset; id: number };
	persist: boolean;
	/** Whether this is a result of a continuous test run request */
	continuous: boolean;
}

/**
 * Request parameters a controller run handler. This is different than
 * {@link IStartControllerTests}. The latter is used to ask for one or more test
 * runs tracked directly by the renderer.
 *
 * This alone can be used to start an autorun, without a specific associated runId.
 */
export interface ICallProfileRunHandler {
	controllerId: string;
	profileId: number;
	excludeExtIds: string[];
	testIds: string[];
}

export const isStartControllerTests = (t: ICallProfileRunHandler | IStartControllerTests): t is IStartControllerTests => ('runId' as keyof IStartControllerTests) in t;

/**
 * Request from the main thread to run tests for a single controller.
 */
export interface IStartControllerTests extends ICallProfileRunHandler {
	runId: string;
}

export interface IStartControllerTestsResult {
	error?: string;
}

/**
 * Location with a fully-instantiated Range and URI.
 */
export interface IRichLocation {
	range: Range;
	uri: URI;
}

export namespace IRichLocation {
	export interface Serialize {
		range: IRange;
		uri: UriComponents;
	}

	export const serialize = (location: IRichLocation): Serialize => ({
		range: location.range.toJSON(),
		uri: location.uri.toJSON(),
	});

	export const deserialize = (location: Serialize): IRichLocation => ({
		range: Range.lift(location.range),
		uri: URI.revive(location.uri),
	});
}

export const enum TestMessageType {
	Error,
	Output
}

export interface ITestErrorMessage {
	message: string | IMarkdownString;
	type: TestMessageType.Error;
	expected: string | undefined;
	actual: string | undefined;
	contextValue: string | undefined;
	location: IRichLocation | undefined;
}

export namespace ITestErrorMessage {
	export interface Serialized {
		message: string | IMarkdownString;
		type: TestMessageType.Error;
		expected: string | undefined;
		actual: string | undefined;
		contextValue: string | undefined;
		location: IRichLocation.Serialize | undefined;
	}

	export const serialize = (message: ITestErrorMessage): Serialized => ({
		message: message.message,
		type: TestMessageType.Error,
		expected: message.expected,
		actual: message.actual,
		contextValue: message.contextValue,
		location: message.location && IRichLocation.serialize(message.location),
	});

	export const deserialize = (message: Serialized): ITestErrorMessage => ({
		message: message.message,
		type: TestMessageType.Error,
		expected: message.expected,
		actual: message.actual,
		contextValue: message.contextValue,
		location: message.location && IRichLocation.deserialize(message.location),
	});
}

export interface ITestOutputMessage {
	message: string;
	type: TestMessageType.Output;
	offset: number;
	length: number;
	marker?: number;
	location: IRichLocation | undefined;
}

/**
 * Gets the TTY marker ID for either starting or ending
 * an ITestOutputMessage.marker of the given ID.
 */
export const getMarkId = (marker: number, start: boolean) => `${start ? 's' : 'e'}${marker}`;

export namespace ITestOutputMessage {
	export interface Serialized {
		message: string;
		offset: number;
		length: number;
		type: TestMessageType.Output;
		location: IRichLocation.Serialize | undefined;
	}

	export const serialize = (message: ITestOutputMessage): Serialized => ({
		message: message.message,
		type: TestMessageType.Output,
		offset: message.offset,
		length: message.length,
		location: message.location && IRichLocation.serialize(message.location),
	});

	export const deserialize = (message: Serialized): ITestOutputMessage => ({
		message: message.message,
		type: TestMessageType.Output,
		offset: message.offset,
		length: message.length,
		location: message.location && IRichLocation.deserialize(message.location),
	});
}

export type ITestMessage = ITestErrorMessage | ITestOutputMessage;

export namespace ITestMessage {
	export type Serialized = ITestErrorMessage.Serialized | ITestOutputMessage.Serialized;

	export const serialize = (message: ITestMessage): Serialized =>
		message.type === TestMessageType.Error ? ITestErrorMessage.serialize(message) : ITestOutputMessage.serialize(message);

	export const deserialize = (message: Serialized): ITestMessage =>
		message.type === TestMessageType.Error ? ITestErrorMessage.deserialize(message) : ITestOutputMessage.deserialize(message);
}

export interface ITestTaskState {
	state: TestResultState;
	duration: number | undefined;
	messages: ITestMessage[];
}

export namespace ITestTaskState {
	export interface Serialized {
		state: TestResultState;
		duration: number | undefined;
		messages: ITestMessage.Serialized[];
	}

	export const serializeWithoutMessages = (state: ITestTaskState): Serialized => ({
		state: state.state,
		duration: state.duration,
		messages: [],
	});

	export const serialize = (state: ITestTaskState): Serialized => ({
		state: state.state,
		duration: state.duration,
		messages: state.messages.map(ITestMessage.serialize),
	});

	export const deserialize = (state: Serialized): ITestTaskState => ({
		state: state.state,
		duration: state.duration,
		messages: state.messages.map(ITestMessage.deserialize),
	});
}

export interface ITestRunTask {
	id: string;
	name: string | undefined;
	running: boolean;
}

export interface ITestTag {
	readonly id: string;
}

const testTagDelimiter = '\0';

export const namespaceTestTag =
	(ctrlId: string, tagId: string) => ctrlId + testTagDelimiter + tagId;

export const denamespaceTestTag = (namespaced: string) => {
	const index = namespaced.indexOf(testTagDelimiter);
	return { ctrlId: namespaced.slice(0, index), tagId: namespaced.slice(index + 1) };
};

export interface ITestTagDisplayInfo {
	id: string;
}

/**
 * The TestItem from .d.ts, as a plain object without children.
 */
export interface ITestItem {
	/** ID of the test given by the test controller */
	extId: string;
	label: string;
	tags: string[];
	busy: boolean;
	children?: never;
	uri: URI | undefined;
	range: Range | null;
	description: string | null;
	error: string | IMarkdownString | null;
	sortText: string | null;
}

export namespace ITestItem {
	export interface Serialized {
		extId: string;
		label: string;
		tags: string[];
		busy: boolean;
		children?: never;
		uri: UriComponents | undefined;
		range: IRange | null;
		description: string | null;
		error: string | IMarkdownString | null;
		sortText: string | null;
	}

	export const serialize = (item: ITestItem): Serialized => ({
		extId: item.extId,
		label: item.label,
		tags: item.tags,
		busy: item.busy,
		//children: undefined,
		uri: item.uri?.toJSON(),
		range: item.range?.toJSON() || null,
		description: item.description,
		error: item.error,
		sortText: item.sortText
	});

	export const deserialize = (serialized: Serialized): ITestItem => ({
		extId: serialized.extId,
		label: serialized.label,
		tags: serialized.tags,
		busy: serialized.busy,
		//children: undefined,
		uri: serialized.uri ? URI.revive(serialized.uri) : undefined,
		range: serialized.range ? Range.lift(serialized.range) : null,
		description: serialized.description,
		error: serialized.error,
		sortText: serialized.sortText
	});
}

export const enum TestItemExpandState {
	NotExpandable,
	Expandable,
	BusyExpanding,
	Expanded,
}

/**
 * TestItem-like shape, but with an ID and children as strings.
 */
export interface InternalTestItem {
	/** Controller ID from whence this test came */
	controllerId: string;
	/** Expandability state */
	expand: TestItemExpandState;
	/** Raw test item properties */
	item: ITestItem;
}

export namespace InternalTestItem {
	export interface Serialized {
		expand: TestItemExpandState;
		item: ITestItem.Serialized;
	}

	export const serialize = (item: InternalTestItem): Serialized => ({
		expand: item.expand,
		item: ITestItem.serialize(item.item)
	});

	export const deserialize = (serialized: Serialized): InternalTestItem => ({
		// the `controllerId` is derived from the test.item.extId. It's redundant
		// in the non-serialized InternalTestItem too, but there just because it's
		// checked against in many hot paths.
		controllerId: TestId.root(serialized.item.extId),
		expand: serialized.expand,
		item: ITestItem.deserialize(serialized.item)
	});
}

/**
 * A partial update made to an existing InternalTestItem.
 */
export interface ITestItemUpdate {
	extId: string;
	expand?: TestItemExpandState;
	item?: Partial<ITestItem>;
}

export namespace ITestItemUpdate {
	export interface Serialized {
		extId: string;
		expand?: TestItemExpandState;
		item?: Partial<ITestItem.Serialized>;
	}

	export const serialize = (u: ITestItemUpdate): Serialized => {
		let item: Partial<ITestItem.Serialized> | undefined;
		if (u.item) {
			item = {};
			if (u.item.label !== undefined) { item.label = u.item.label; }
			if (u.item.tags !== undefined) { item.tags = u.item.tags; }
			if (u.item.busy !== undefined) { item.busy = u.item.busy; }
			if (u.item.uri !== undefined) { item.uri = u.item.uri?.toJSON(); }
			if (u.item.range !== undefined) { item.range = u.item.range?.toJSON(); }
			if (u.item.description !== undefined) { item.description = u.item.description; }
			if (u.item.error !== undefined) { item.error = u.item.error; }
			if (u.item.sortText !== undefined) { item.sortText = u.item.sortText; }
		}

		return { extId: u.extId, expand: u.expand, item };
	};

	export const deserialize = (u: Serialized): ITestItemUpdate => {
		let item: Partial<ITestItem> | undefined;
		if (u.item) {
			item = {};
			if (u.item.label !== undefined) { item.label = u.item.label; }
			if (u.item.tags !== undefined) { item.tags = u.item.tags; }
			if (u.item.busy !== undefined) { item.busy = u.item.busy; }
			if (u.item.range !== undefined) { item.range = u.item.range ? Range.lift(u.item.range) : null; }
			if (u.item.description !== undefined) { item.description = u.item.description; }
			if (u.item.error !== undefined) { item.error = u.item.error; }
			if (u.item.sortText !== undefined) { item.sortText = u.item.sortText; }
		}

		return { extId: u.extId, expand: u.expand, item };
	};

}

export const applyTestItemUpdate = (internal: InternalTestItem | ITestItemUpdate, patch: ITestItemUpdate) => {
	if (patch.expand !== undefined) {
		internal.expand = patch.expand;
	}
	if (patch.item !== undefined) {
		internal.item = internal.item ? Object.assign(internal.item, patch.item) : patch.item;
	}
};

/**
 * Test result item used in the main thread.
 */
export interface TestResultItem extends InternalTestItem {
	/** State of this test in various tasks */
	tasks: ITestTaskState[];
	/** State of this test as a computation of its tasks */
	ownComputedState: TestResultState;
	/** Computed state based on children */
	computedState: TestResultState;
	/** Max duration of the item's tasks (if run directly) */
	ownDuration?: number;
	/** Whether this test item is outdated */
	retired?: boolean;
}

export namespace TestResultItem {
	/**
	 * Serialized version of the TestResultItem. Note that 'retired' is not
	 * included since all hydrated items are automatically retired.
	 */
	export interface Serialized extends InternalTestItem.Serialized {
		tasks: ITestTaskState.Serialized[];
		ownComputedState: TestResultState;
		computedState: TestResultState;
	}

	export const serializeWithoutMessages = (original: TestResultItem): Serialized => ({
		...InternalTestItem.serialize(original),
		ownComputedState: original.ownComputedState,
		computedState: original.computedState,
		tasks: original.tasks.map(ITestTaskState.serializeWithoutMessages),
	});

	export const serialize = (original: TestResultItem): Serialized => ({
		...InternalTestItem.serialize(original),
		ownComputedState: original.ownComputedState,
		computedState: original.computedState,
		tasks: original.tasks.map(ITestTaskState.serialize),
	});

	export const deserialize = (serialized: Serialized): TestResultItem => ({
		...InternalTestItem.deserialize(serialized),
		ownComputedState: serialized.ownComputedState,
		computedState: serialized.computedState,
		tasks: serialized.tasks.map(ITestTaskState.deserialize),
		retired: true,
	});
}

export interface ISerializedTestResults {
	/** ID of these test results */
	id: string;
	/** Time the results were compelted */
	completedAt: number;
	/** Subset of test result items */
	items: TestResultItem.Serialized[];
	/** Tasks involved in the run. */
	tasks: { id: string; name: string | undefined }[];
	/** Human-readable name of the test run. */
	name: string;
	/** Test trigger informaton */
	request: ResolvedTestRunRequest;
}

export interface ITestCoverage {
	files: IFileCoverage[];
}

export interface ICoveredCount {
	covered: number;
	total: number;
}

export interface IFileCoverage {
	uri: URI;
	statement: ICoveredCount;
	branch?: ICoveredCount;
	function?: ICoveredCount;
	details?: CoverageDetails[];
}

export const enum DetailType {
	Function,
	Statement,
}

export type CoverageDetails = IFunctionCoverage | IStatementCoverage;

export interface IBranchCoverage {
	count: number;
	location?: IRange | IPosition;
}

export interface IFunctionCoverage {
	type: DetailType.Function;
	count: number;
	location?: IRange | IPosition;
}

export interface IStatementCoverage {
	type: DetailType.Statement;
	count: number;
	location: IRange | IPosition;
	branches?: IBranchCoverage[];
}

export const enum TestDiffOpType {
	/** Adds a new test (with children) */
	Add,
	/** Shallow-updates an existing test */
	Update,
	/** Ranges of some tests in a document were synced, so it should be considered up-to-date */
	DocumentSynced,
	/** Removes a test (and all its children) */
	Remove,
	/** Changes the number of controllers who are yet to publish their collection roots. */
	IncrementPendingExtHosts,
	/** Retires a test/result */
	Retire,
	/** Add a new test tag */
	AddTag,
	/** Remove a test tag */
	RemoveTag,
}

export type TestsDiffOp =
	| { op: TestDiffOpType.Add; item: InternalTestItem }
	| { op: TestDiffOpType.Update; item: ITestItemUpdate }
	| { op: TestDiffOpType.Remove; itemId: string }
	| { op: TestDiffOpType.Retire; itemId: string }
	| { op: TestDiffOpType.IncrementPendingExtHosts; amount: number }
	| { op: TestDiffOpType.AddTag; tag: ITestTagDisplayInfo }
	| { op: TestDiffOpType.RemoveTag; id: string }
	| { op: TestDiffOpType.DocumentSynced; uri: URI; docv?: number };

export namespace TestsDiffOp {
	export type Serialized =
		| { op: TestDiffOpType.Add; item: InternalTestItem.Serialized }
		| { op: TestDiffOpType.Update; item: ITestItemUpdate.Serialized }
		| { op: TestDiffOpType.Remove; itemId: string }
		| { op: TestDiffOpType.Retire; itemId: string }
		| { op: TestDiffOpType.IncrementPendingExtHosts; amount: number }
		| { op: TestDiffOpType.AddTag; tag: ITestTagDisplayInfo }
		| { op: TestDiffOpType.RemoveTag; id: string }
		| { op: TestDiffOpType.DocumentSynced; uri: UriComponents; docv?: number };

	export const deserialize = (u: Serialized): TestsDiffOp => {
		if (u.op === TestDiffOpType.Add) {
			return { op: u.op, item: InternalTestItem.deserialize(u.item) };
		} else if (u.op === TestDiffOpType.Update) {
			return { op: u.op, item: ITestItemUpdate.deserialize(u.item) };
		} else if (u.op === TestDiffOpType.DocumentSynced) {
			return { op: u.op, uri: URI.revive(u.uri), docv: u.docv };
		} else {
			return u;
		}
	};

	export const serialize = (u: TestsDiffOp): Serialized => {
		if (u.op === TestDiffOpType.Add) {
			return { op: u.op, item: InternalTestItem.serialize(u.item) };
		} else if (u.op === TestDiffOpType.Update) {
			return { op: u.op, item: ITestItemUpdate.serialize(u.item) };
		} else {
			return u;
		}
	};
}

/**
 * Context for actions taken in the test explorer view.
 */
export interface ITestItemContext {
	/** Marshalling marker */
	$mid: MarshalledId.TestItemContext;
	/** Tests and parents from the root to the current items */
	tests: InternalTestItem.Serialized[];
}

/**
 * Context for actions taken in the test explorer view.
 */
export interface ITestMessageMenuArgs {
	/** Marshalling marker */
	$mid: MarshalledId.TestMessageMenuArgs;
	/** Tests ext ID */
	extId: string;
	/** Serialized test message */
	message: ITestMessage.Serialized;
}

/**
 * Request from the ext host or main thread to indicate that tests have
 * changed. It's assumed that any item upserted *must* have its children
 * previously also upserted, or upserted as part of the same operation.
 * Children that no longer exist in an upserted item will be removed.
 */
export type TestsDiff = TestsDiffOp[];

/**
 * @private
 */
export interface IncrementalTestCollectionItem extends InternalTestItem {
	children: Set<string>;
}

/**
 * The IncrementalChangeCollector is used in the IncrementalTestCollection
 * and called with diff changes as they're applied. This is used in the
 * ext host to create a cohesive change event from a diff.
 */
export interface IncrementalChangeCollector<T> {
	/**
	 * A node was added.
	 */
	add?(node: T): void;

	/**
	 * A node in the collection was updated.
	 */
	update?(node: T): void;

	/**
	 * A node was removed.
	 */
	remove?(node: T, isNestedOperation: boolean): void;

	/**
	 * Called when the diff has been applied.
	 */
	complete?(): void;
}

/**
 * Maintains tests in this extension host sent from the main thread.
 */
export abstract class AbstractIncrementalTestCollection<T extends IncrementalTestCollectionItem>  {
	private readonly _tags = new Map<string, ITestTagDisplayInfo>();

	/**
	 * Map of item IDs to test item objects.
	 */
	protected readonly items = new Map<string, T>();

	/**
	 * ID of test root items.
	 */
	protected readonly roots = new Set<T>();

	/**
	 * Number of 'busy' controllers.
	 */
	protected busyControllerCount = 0;

	/**
	 * Number of pending roots.
	 */
	protected pendingRootCount = 0;

	/**
	 * Known test tags.
	 */
	public readonly tags: ReadonlyMap<string, ITestTagDisplayInfo> = this._tags;

	/**
	 * Applies the diff to the collection.
	 */
	public apply(diff: TestsDiff) {
		const changes = this.createChangeCollector();

		for (const op of diff) {
			switch (op.op) {
				case TestDiffOpType.Add:
					this.add(InternalTestItem.deserialize(op.item), changes);
					break;

				case TestDiffOpType.Update:
					this.update(ITestItemUpdate.deserialize(op.item), changes);
					break;

				case TestDiffOpType.Remove:
					this.remove(op.itemId, changes);
					break;

				case TestDiffOpType.Retire:
					this.retireTest(op.itemId);
					break;

				case TestDiffOpType.IncrementPendingExtHosts:
					this.updatePendingRoots(op.amount);
					break;

				case TestDiffOpType.AddTag:
					this._tags.set(op.tag.id, op.tag);
					break;

				case TestDiffOpType.RemoveTag:
					this._tags.delete(op.id);
					break;
			}
		}

		changes.complete?.();
	}

	protected add(item: InternalTestItem, changes: IncrementalChangeCollector<T>
	) {
		const parentId = TestId.parentId(item.item.extId)?.toString();
		let created: T;
		if (!parentId) {
			created = this.createItem(item);
			this.roots.add(created);
			this.items.set(item.item.extId, created);
		} else if (this.items.has(parentId)) {
			const parent = this.items.get(parentId)!;
			parent.children.add(item.item.extId);
			created = this.createItem(item, parent);
			this.items.set(item.item.extId, created);
		} else {
			console.error(`Test with unknown parent ID: ${JSON.stringify(item)}`);
			return undefined;
		}

		changes.add?.(created);
		if (item.expand === TestItemExpandState.BusyExpanding) {
			this.busyControllerCount++;
		}

		return created;
	}

	protected update(patch: ITestItemUpdate, changes: IncrementalChangeCollector<T>
	) {
		const existing = this.items.get(patch.extId);
		if (!existing) {
			return undefined;
		}

		if (patch.expand !== undefined) {
			if (existing.expand === TestItemExpandState.BusyExpanding) {
				this.busyControllerCount--;
			}
			if (patch.expand === TestItemExpandState.BusyExpanding) {
				this.busyControllerCount++;
			}
		}

		applyTestItemUpdate(existing, patch);
		changes.update?.(existing);
		return existing;
	}

	protected remove(itemId: string, changes: IncrementalChangeCollector<T>) {
		const toRemove = this.items.get(itemId);
		if (!toRemove) {
			return;
		}

		const parentId = TestId.parentId(toRemove.item.extId)?.toString();
		if (parentId) {
			const parent = this.items.get(parentId)!;
			parent.children.delete(toRemove.item.extId);
		} else {
			this.roots.delete(toRemove);
		}

		const queue: Iterable<string>[] = [[itemId]];
		while (queue.length) {
			for (const itemId of queue.pop()!) {
				const existing = this.items.get(itemId);
				if (existing) {
					queue.push(existing.children);
					this.items.delete(itemId);
					changes.remove?.(existing, existing !== toRemove);

					if (existing.expand === TestItemExpandState.BusyExpanding) {
						this.busyControllerCount--;
					}
				}
			}
		}
	}

	/**
	 * Called when the extension signals a test result should be retired.
	 */
	protected retireTest(testId: string) {
		// no-op
	}

	/**
	 * Updates the number of test root sources who are yet to report. When
	 * the total pending test roots reaches 0, the roots for all controllers
	 * will exist in the collection.
	 */
	public updatePendingRoots(delta: number) {
		this.pendingRootCount += delta;
	}

	/**
	 * Called before a diff is applied to create a new change collector.
	 */
	protected createChangeCollector(): IncrementalChangeCollector<T> {
		return {};
	}

	/**
	 * Creates a new item for the collection from the internal test item.
	 */
	protected abstract createItem(internal: InternalTestItem, parent?: T): T;
}
