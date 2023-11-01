/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { groupBy } from 'vs/base/common/arrays';
import { CancellationToken, CancellationTokenSource } from 'vs/base/common/cancellation';
import { Emitter } from 'vs/base/common/event';
import { Iterable } from 'vs/base/common/iterator';
import { Disposable, DisposableStore, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { localize } from 'vs/nls';
import { IContextKey, IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IWorkspaceTrustRequestService } from 'vs/platform/workspace/common/workspaceTrust';
import { MainThreadTestCollection } from 'vs/workbench/contrib/testing/common/mainThreadTestCollection';
import { MutableObservableValue } from 'vs/workbench/contrib/testing/common/observableValue';
import { StoredValue } from 'vs/workbench/contrib/testing/common/storedValue';
import { ResolvedTestRunRequest, TestDiffOpType, TestsDiff } from 'vs/workbench/contrib/testing/common/testTypes';
import { TestExclusions } from 'vs/workbench/contrib/testing/common/testExclusions';
import { TestId } from 'vs/workbench/contrib/testing/common/testId';
import { TestingContextKeys } from 'vs/workbench/contrib/testing/common/testingContextKeys';
import { canUseProfileWithTest, ITestProfileService } from 'vs/workbench/contrib/testing/common/testProfileService';
import { ITestResult } from 'vs/workbench/contrib/testing/common/testResult';
import { ITestResultService } from 'vs/workbench/contrib/testing/common/testResultService';
import { AmbiguousRunTestsRequest, IMainThreadTestController, ITestService } from 'vs/workbench/contrib/testing/common/testService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { getTestingConfiguration, TestingConfigKeys } from 'vs/workbench/contrib/testing/common/configuration';
import { isDefined } from 'vs/base/common/types';

export class TestService extends Disposable implements ITestService {
	declare readonly _serviceBrand: undefined;
	private testControllers = new Map<string, IMainThreadTestController>();

	private readonly cancelExtensionTestRunEmitter = new Emitter<{ runId: string | undefined }>();
	private readonly willProcessDiffEmitter = new Emitter<TestsDiff>();
	private readonly didProcessDiffEmitter = new Emitter<TestsDiff>();
	private readonly testRefreshCancellations = new Set<CancellationTokenSource>();
	private readonly providerCount: IContextKey<number>;
	private readonly canRefreshTests: IContextKey<boolean>;
	private readonly isRefreshingTests: IContextKey<boolean>;
	private readonly activeEditorHasTests: IContextKey<boolean>;

	/**
	 * Cancellation for runs requested by the user being managed by the UI.
	 * Test runs initiated by extensions are not included here.
	 */
	private readonly uiRunningTests = new Map<string /* run ID */, CancellationTokenSource>();

	/**
	 * @inheritdoc
	 */
	public readonly onWillProcessDiff = this.willProcessDiffEmitter.event;

	/**
	 * @inheritdoc
	 */
	public readonly onDidProcessDiff = this.didProcessDiffEmitter.event;

	/**
	 * @inheritdoc
	 */
	public readonly onDidCancelTestRun = this.cancelExtensionTestRunEmitter.event;

	/**
	 * @inheritdoc
	 */
	public readonly collection = new MainThreadTestCollection(this.expandTest.bind(this));

	/**
	 * @inheritdoc
	 */
	public readonly excluded: TestExclusions;

	/**
	 * @inheritdoc
	 */
	public readonly showInlineOutput = MutableObservableValue.stored(this._register(new StoredValue<boolean>({
		key: 'inlineTestOutputVisible',
		scope: StorageScope.WORKSPACE,
		target: StorageTarget.USER
	}, this.storage)), true);

	constructor(
		@IContextKeyService contextKeyService: IContextKeyService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IStorageService private readonly storage: IStorageService,
		@IEditorService private readonly editorService: IEditorService,
		@ITestProfileService private readonly testProfiles: ITestProfileService,
		@INotificationService private readonly notificationService: INotificationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ITestResultService private readonly testResults: ITestResultService,
		@IWorkspaceTrustRequestService private readonly workspaceTrustRequestService: IWorkspaceTrustRequestService,
	) {
		super();
		this.excluded = instantiationService.createInstance(TestExclusions);
		this.providerCount = TestingContextKeys.providerCount.bindTo(contextKeyService);
		this.canRefreshTests = TestingContextKeys.canRefreshTests.bindTo(contextKeyService);
		this.isRefreshingTests = TestingContextKeys.isRefreshingTests.bindTo(contextKeyService);
		this.activeEditorHasTests = TestingContextKeys.activeEditorHasTests.bindTo(contextKeyService);

		this._register(editorService.onDidActiveEditorChange(() => this.updateEditorContextKeys()));
	}

	/**
	 * @inheritdoc
	 */
	public async expandTest(id: string, levels: number) {
		await this.testControllers.get(TestId.fromString(id).controllerId)?.expandTest(id, levels);
	}

	/**
	 * @inheritdoc
	 */
	public cancelTestRun(runId?: string) {
		this.cancelExtensionTestRunEmitter.fire({ runId });

		if (runId === undefined) {
			for (const runCts of this.uiRunningTests.values()) {
				runCts.cancel();
			}
		} else {
			this.uiRunningTests.get(runId)?.cancel();
		}
	}

	/**
	 * @inheritdoc
	 */
	public async runTests(req: AmbiguousRunTestsRequest, token = CancellationToken.None): Promise<ITestResult> {
		const resolved: ResolvedTestRunRequest = {
			targets: [],
			exclude: req.exclude?.map(t => t.item.extId),
			continuous: req.continuous,
		};

		// First, try to run the tests using the default run profiles...
		for (const profile of this.testProfiles.getGroupDefaultProfiles(req.group)) {
			const testIds = req.tests.filter(t => canUseProfileWithTest(profile, t)).map(t => t.item.extId);
			if (testIds.length) {
				resolved.targets.push({
					testIds: testIds,
					profileGroup: profile.group,
					profileId: profile.profileId,
					controllerId: profile.controllerId,
				});
			}
		}

		// If no tests are covered by the defaults, just use whatever the defaults
		// for their controller are. This can happen if the user chose specific
		// profiles for the run button, but then asked to run a single test from the
		// explorer or decoration. We shouldn't no-op.
		if (resolved.targets.length === 0) {
			for (const byController of groupBy(req.tests, (a, b) => a.controllerId === b.controllerId ? 0 : 1)) {
				const profiles = this.testProfiles.getControllerProfiles(byController[0].controllerId);
				const withControllers = byController.map(test => ({
					profile: profiles.find(p => p.group === req.group && canUseProfileWithTest(p, test)),
					test,
				}));

				for (const byProfile of groupBy(withControllers, (a, b) => a.profile === b.profile ? 0 : 1)) {
					const profile = byProfile[0].profile;
					if (profile) {
						resolved.targets.push({
							testIds: byProfile.map(t => t.test.item.extId),
							profileGroup: req.group,
							profileId: profile.profileId,
							controllerId: profile.controllerId,
						});
					}
				}
			}
		}

		return this.runResolvedTests(resolved, token);
	}

	/** @inheritdoc */
	public async startContinuousRun(req: ResolvedTestRunRequest, token: CancellationToken) {
		if (!req.exclude) {
			req.exclude = [...this.excluded.all];
		}

		const trust = await this.workspaceTrustRequestService.requestWorkspaceTrust({
			message: localize('testTrust', "Running tests may execute code in your workspace."),
		});

		if (!trust) {
			return;
		}

		const byController = groupBy(req.targets, (a, b) => a.controllerId.localeCompare(b.controllerId));
		const requests = byController.map(
			group => this.testControllers.get(group[0].controllerId)?.startContinuousRun(
				group.map(controlReq => ({
					excludeExtIds: req.exclude!.filter(t => !controlReq.testIds.includes(t)),
					profileId: controlReq.profileId,
					controllerId: controlReq.controllerId,
					testIds: controlReq.testIds,
				})),
				token,
			).then(result => {
				const errs = result.map(r => r.error).filter(isDefined);
				if (errs.length) {
					this.notificationService.error(localize('testError', 'An error occurred attempting to run tests: {0}', errs.join(' ')));
				}
			})
		);

		await Promise.all(requests);
	}

	/**
	 * @inheritdoc
	 */
	public async runResolvedTests(req: ResolvedTestRunRequest, token = CancellationToken.None) {
		if (!req.exclude) {
			req.exclude = [...this.excluded.all];
		}

		const result = this.testResults.createLiveResult(req);
		const trust = await this.workspaceTrustRequestService.requestWorkspaceTrust({
			message: localize('testTrust', "Running tests may execute code in your workspace."),
		});

		if (!trust) {
			result.markComplete();
			return result;
		}

		try {
			const cancelSource = new CancellationTokenSource(token);
			this.uiRunningTests.set(result.id, cancelSource);

			const byController = groupBy(req.targets, (a, b) => a.controllerId.localeCompare(b.controllerId));
			const requests = byController.map(
				group => this.testControllers.get(group[0].controllerId)?.runTests(
					group.map(controlReq => ({
						runId: result.id,
						excludeExtIds: req.exclude!.filter(t => !controlReq.testIds.includes(t)),
						profileId: controlReq.profileId,
						controllerId: controlReq.controllerId,
						testIds: controlReq.testIds,
					})),
					cancelSource.token,
				).then(result => {
					const errs = result.map(r => r.error).filter(isDefined);
					if (errs.length) {
						this.notificationService.error(localize('testError', 'An error occurred attempting to run tests: {0}', errs.join(' ')));
					}
				})
			);
			await this.saveAllBeforeTest(req);
			await Promise.all(requests);
			return result;
		} finally {
			this.uiRunningTests.delete(result.id);
			result.markComplete();
		}
	}

	/**
	 * @inheritdoc
	 */
	public publishDiff(_controllerId: string, diff: TestsDiff) {
		this.willProcessDiffEmitter.fire(diff);
		this.collection.apply(diff);
		this.updateEditorContextKeys();
		this.didProcessDiffEmitter.fire(diff);
	}

	/**
	 * @inheritdoc
	 */
	public getTestController(id: string) {
		return this.testControllers.get(id);
	}

	/**
	 * @inheritdoc
	 */
	public async syncTests(): Promise<void> {
		const cts = new CancellationTokenSource();
		try {
			await Promise.all([...this.testControllers.values()].map(c => c.syncTests(cts.token)));
		} finally {
			cts.dispose(true);
		}
	}

	/**
	 * @inheritdoc
	 */
	public async refreshTests(controllerId?: string): Promise<void> {
		const cts = new CancellationTokenSource();
		this.testRefreshCancellations.add(cts);
		this.isRefreshingTests.set(true);

		try {
			if (controllerId) {
				await this.testControllers.get(controllerId)?.refreshTests(cts.token);
			} else {
				await Promise.all([...this.testControllers.values()].map(c => c.refreshTests(cts.token)));
			}
		} finally {
			this.testRefreshCancellations.delete(cts);
			this.isRefreshingTests.set(this.testRefreshCancellations.size > 0);
			cts.dispose(true);
		}
	}

	/**
	 * @inheritdoc
	 */
	public cancelRefreshTests(): void {
		for (const cts of this.testRefreshCancellations) {
			cts.cancel();
		}
		this.testRefreshCancellations.clear();
		this.isRefreshingTests.set(false);
	}

	/**
	 * @inheritdoc
	 */
	public registerTestController(id: string, controller: IMainThreadTestController): IDisposable {
		this.testControllers.set(id, controller);
		this.providerCount.set(this.testControllers.size);
		this.updateCanRefresh();

		const disposable = new DisposableStore();

		disposable.add(toDisposable(() => {
			const diff: TestsDiff = [];
			for (const root of this.collection.rootItems) {
				if (root.controllerId === id) {
					diff.push({ op: TestDiffOpType.Remove, itemId: root.item.extId });
				}
			}

			this.publishDiff(id, diff);

			if (this.testControllers.delete(id)) {
				this.providerCount.set(this.testControllers.size);
				this.updateCanRefresh();
			}
		}));

		disposable.add(controller.canRefresh.onDidChange(this.updateCanRefresh, this));

		return disposable;
	}

	private updateEditorContextKeys() {
		const uri = this.editorService.activeEditor?.resource;
		if (uri) {
			this.activeEditorHasTests.set(!Iterable.isEmpty(this.collection.getNodeByUrl(uri)));
		} else {
			this.activeEditorHasTests.set(false);
		}
	}

	private async saveAllBeforeTest(req: ResolvedTestRunRequest, configurationService: IConfigurationService = this.configurationService, editorService: IEditorService = this.editorService): Promise<void> {
		if (req.isUiTriggered === false) {
			return;
		}
		const saveBeforeTest = getTestingConfiguration(this.configurationService, TestingConfigKeys.SaveBeforeTest);
		if (saveBeforeTest) {
			await editorService.saveAll();
		}
		return;
	}

	private updateCanRefresh() {
		this.canRefreshTests.set(Iterable.some(this.testControllers.values(), t => t.canRefresh.value));
	}
}


