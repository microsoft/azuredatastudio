/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { language } from 'vs/base/common/platform';
import { IWorkbenchContributionsRegistry, IWorkbenchContribution, Extensions as WorkbenchExtensions } from 'vs/workbench/common/contributions';
import { Registry } from 'vs/platform/registry/common/platform';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { IProductService } from 'vs/platform/product/common/productService';
import { LifecyclePhase } from 'vs/workbench/services/lifecycle/common/lifecycle';
import { Severity, INotificationService } from 'vs/platform/notification/common/notification';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IWorkbenchAssignmentService } from 'vs/workbench/services/assignment/common/assignmentService';
import { URI } from 'vs/base/common/uri';
import { platform } from 'vs/base/common/process';
import { ThrottledDelayer } from 'vs/base/common/async';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';

const WAIT_TIME_TO_SHOW_SURVEY = 1000 * 60 * 60; // 1 hour
const MIN_WAIT_TIME_TO_SHOW_SURVEY = 1000 * 60 * 2; // 2 minutes
const MAX_INSTALL_AGE = 1000 * 60 * 60 * 24; // 24 hours
const REMIND_LATER_DELAY = 1000 * 60 * 60 * 4; // 4 hours
const SKIP_SURVEY_KEY = 'ces/skipSurvey';
const REMIND_LATER_DATE_KEY = 'ces/remindLaterDate';

class CESContribution extends Disposable implements IWorkbenchContribution {

	private promptDelayer = this._register(new ThrottledDelayer<void>(0));
	private readonly tasExperimentService: IWorkbenchAssignmentService | undefined;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IProductService private readonly productService: IProductService,
		@IWorkbenchAssignmentService tasExperimentService: IWorkbenchAssignmentService,
	) {
		super();

		this.tasExperimentService = tasExperimentService;

		if (!productService.cesSurveyUrl) {
			return;
		}

		const skipSurvey = storageService.get(SKIP_SURVEY_KEY, StorageScope.APPLICATION, '');
		if (skipSurvey) {
			return;
		}

		this.schedulePrompt();
	}

	private async promptUser() {
		const isCandidate = await this.tasExperimentService?.getTreatment<boolean>('CESSurvey');
		if (!isCandidate) {
			this.skipSurvey();
			return;
		}

		const sendTelemetry = (userReaction: 'accept' | 'remindLater' | 'neverShowAgain' | 'cancelled') => {
			/* __GDPR__
			"cesSurvey:popup" : {
				"owner": "digitarald",
				"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
			*/
			this.telemetryService.publicLog('cesSurvey:popup', { userReaction });
		};

		const message = await this.tasExperimentService?.getTreatment<string>('CESSurveyMessage') ?? nls.localize('cesSurveyQuestion', 'Got a moment to help the VS Code team? Please tell us about your experience with VS Code so far.');
		const button = await this.tasExperimentService?.getTreatment<string>('CESSurveyButton') ?? nls.localize('giveFeedback', "Give Feedback");

		const notification = this.notificationService.prompt(
			Severity.Info,
			message,
			[{
				label: button,
				run: () => {
					sendTelemetry('accept');
					let surveyUrl = `${this.productService.cesSurveyUrl}?o=${encodeURIComponent(platform)}&v=${encodeURIComponent(this.productService.version)}&m=${encodeURIComponent(this.telemetryService.machineId)}`;

					const usedParams = this.productService.surveys
						?.filter(surveyData => surveyData.surveyId && surveyData.languageId)
						// Counts provided by contrib/surveys/browser/languageSurveys
						.filter(surveyData => this.storageService.getNumber(`${surveyData.surveyId}.editedCount`, StorageScope.APPLICATION, 0) > 0)
						.map(surveyData => `${encodeURIComponent(surveyData.languageId)}Lang=1`)
						.join('&');
					if (usedParams) {
						surveyUrl += `&${usedParams}`;
					}
					this.openerService.open(URI.parse(surveyUrl));
					this.skipSurvey();
				}
			}, {
				label: nls.localize('remindLater', "Remind Me Later"),
				run: () => {
					sendTelemetry('remindLater');
					this.storageService.store(REMIND_LATER_DATE_KEY, new Date().toUTCString(), StorageScope.APPLICATION, StorageTarget.USER);
					this.schedulePrompt();
				}
			}],
			{
				sticky: true,
				onCancel: () => {
					sendTelemetry('cancelled');
					this.skipSurvey();
				}
			}
		);

		await Event.toPromise(notification.onDidClose);
	}

	private async schedulePrompt(): Promise<void> {
		let waitTimeToShowSurvey = 0;
		const remindLaterDate = this.storageService.get(REMIND_LATER_DATE_KEY, StorageScope.APPLICATION, '');
		if (remindLaterDate) {
			const timeToRemind = new Date(remindLaterDate).getTime() + REMIND_LATER_DELAY - Date.now();
			if (timeToRemind > 0) {
				waitTimeToShowSurvey = timeToRemind;
			}
		} else {
			const timeFromInstall = Date.now() - new Date(this.telemetryService.firstSessionDate).getTime();
			const isNewInstall = !isNaN(timeFromInstall) && timeFromInstall < MAX_INSTALL_AGE;

			// Installation is older than MAX_INSTALL_AGE
			if (!isNewInstall) {
				this.skipSurvey();
				return;
			}
			if (timeFromInstall < WAIT_TIME_TO_SHOW_SURVEY) {
				waitTimeToShowSurvey = WAIT_TIME_TO_SHOW_SURVEY - timeFromInstall;
			}
		}
		/* __GDPR__
		"cesSurvey:schedule" : {
			"owner": "digitarald"
		}
		*/
		this.telemetryService.publicLog('cesSurvey:schedule');

		this.promptDelayer.trigger(async () => {
			await this.promptUser();
		}, Math.max(waitTimeToShowSurvey, MIN_WAIT_TIME_TO_SHOW_SURVEY));
	}

	private skipSurvey(): void {
		this.storageService.store(SKIP_SURVEY_KEY, this.productService.version, StorageScope.APPLICATION, StorageTarget.USER);
	}
}

if (language === 'en') {
	const workbenchRegistry = Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench);
	workbenchRegistry.registerWorkbenchContribution(CESContribution, LifecyclePhase.Restored);
}
