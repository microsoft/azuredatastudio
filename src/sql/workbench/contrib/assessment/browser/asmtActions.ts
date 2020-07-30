/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from 'vs/base/common/actions';
import * as nls from 'vs/nls';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ILogService } from 'vs/platform/log/common/log';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IAssessmentService } from 'sql/workbench/services/assessment/common/interfaces';
import { SqlAssessmentResult } from 'azdata';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IFileService } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { AssessmentType, AssessmentTargetType, TARGET_ICON_CLASS } from 'sql/workbench/contrib/assessment/common/consts';
import { TelemetryView } from 'sql/platform/telemetry/common/telemetryKeys';
import { VSBuffer } from 'vs/base/common/buffer';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import * as path from 'vs/base/common/path';
import { HTMLReportBuilder } from 'sql/workbench/contrib/assessment/common/htmlReportGenerator';
import Severity from 'vs/base/common/severity';
import { INotificationService } from 'vs/platform/notification/common/notification';

export interface SqlAssessmentResultInfo {
	result: SqlAssessmentResult;
	dateUpdated: number;
	connectionInfo: any
}

export interface IAssessmentComponent {
	showProgress(mode: AssessmentType): any;
	showInitialResults(result: SqlAssessmentResult, method: AssessmentType): any;
	appendResults(result: SqlAssessmentResult, method: AssessmentType): any;
	stopProgress(mode: AssessmentType): any;
	recentResult: SqlAssessmentResultInfo;
	isActive: boolean;
}


export class IAsmtActionInfo {
	ownerUri?: string;
	component: IAssessmentComponent;
	connectionId: string;
}



abstract class AsmtServerAction extends Action {
	constructor(
		id: string,
		label: string,
		private asmtType: AssessmentType,
		@IConnectionManagementService private _connectionManagement: IConnectionManagementService,
		@ILogService protected _logService: ILogService,
		@IAdsTelemetryService protected _telemetryService: IAdsTelemetryService
	) {
		super(id, label, TARGET_ICON_CLASS[AssessmentTargetType.Server]);
	}

	public async run(context: IAsmtActionInfo): Promise<boolean> {
		this._telemetryService.sendActionEvent(TelemetryView.SqlAssessment, this.id);
		if (context && context.component) {
			context.component.showProgress(this.asmtType);
			let serverResults = this.getServerItems(context.ownerUri);
			let connectionUri: string = this._connectionManagement.getConnectionUriFromId(context.connectionId);
			let connection = this._connectionManagement.getConnection(connectionUri);
			let databaseListResult = this._connectionManagement.listDatabases(connectionUri);
			context.component.showInitialResults(await serverResults, this.asmtType);
			let dbList = await databaseListResult;
			if (dbList) {
				for (let nDbName = 0; nDbName < dbList.databaseNames.length; nDbName++) {
					if (!context.component.isActive) {
						break;
					}
					let dbName = dbList.databaseNames[nDbName];
					let newUri = await this._connectionManagement.connectIfNotConnected(connection.cloneWithDatabase(dbName).clone());

					this._logService.info(`Database ${dbName} assessment started`);
					let dbResult = await this.getDatabaseItems(newUri);
					this._logService.info(`Database ${dbName} assessment completed`);

					context.component.appendResults(dbResult, this.asmtType);
				}
			}

			context.component.stopProgress(this.asmtType);

			return true;
		}

		return false;
	}

	abstract getServerItems(ownerUri: string): Thenable<SqlAssessmentResult>;
	abstract getDatabaseItems(ownerUri: string): Thenable<SqlAssessmentResult>;
}


export class AsmtServerSelectItemsAction extends AsmtServerAction {
	public static ID = 'asmtaction.server.getitems';
	public static LABEL = nls.localize('asmtaction.server.getitems', "View applicable rules");

	constructor(
		@IConnectionManagementService _connectionManagement: IConnectionManagementService,
		@ILogService _logService: ILogService,
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService _telemetryService: IAdsTelemetryService
	) {
		super(AsmtServerSelectItemsAction.ID, AsmtServerSelectItemsAction.LABEL,
			AssessmentType.AvailableRules,
			_connectionManagement,
			_logService, _telemetryService);
	}

	getServerItems(ownerUri: string): Thenable<SqlAssessmentResult> {
		return this._assessmentService.getAssessmentItems(ownerUri, AssessmentTargetType.Server);
	}

	getDatabaseItems(ownerUri: string): Thenable<SqlAssessmentResult> {
		return this._assessmentService.getAssessmentItems(ownerUri, AssessmentTargetType.Database);
	}
}

export class AsmtDatabaseSelectItemsAction extends Action {
	public static ID = 'asmtaction.database.getitems';

	constructor(
		databaseName: string,
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(AsmtDatabaseSelectItemsAction.ID,
			nls.localize('asmtaction.database.getitems', "View applicable rules for {0}", databaseName),
			TARGET_ICON_CLASS[AssessmentTargetType.Database]);
	}

	public async run(context: IAsmtActionInfo): Promise<boolean> {
		this._telemetryService.sendActionEvent(TelemetryView.SqlAssessment, this.id);
		if (context && context.component) {
			context.component.showProgress(AssessmentType.AvailableRules);
			let dbAsmtResults = await this._assessmentService.getAssessmentItems(context.ownerUri, AssessmentTargetType.Database);
			context.component.showInitialResults(dbAsmtResults, AssessmentType.AvailableRules);
			context.component.stopProgress(AssessmentType.AvailableRules);
			return true;
		}
		return false;
	}
}

export class AsmtServerInvokeItemsAction extends AsmtServerAction {
	public static ID = 'asmtaction.server.invokeitems';
	public static LABEL = nls.localize('asmtaction.server.invokeitems', "Invoke Assessment");

	constructor(
		@IConnectionManagementService _connectionManagement: IConnectionManagementService,
		@ILogService _logService: ILogService,
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService _telemetryService: IAdsTelemetryService
	) {
		super(AsmtServerInvokeItemsAction.ID, AsmtServerInvokeItemsAction.LABEL, AssessmentType.InvokeAssessment, _connectionManagement, _logService, _telemetryService);
	}
	getServerItems(ownerUri: string): Thenable<SqlAssessmentResult> {
		this._logService.info(`Requesting server items`);
		return this._assessmentService.assessmentInvoke(ownerUri, AssessmentTargetType.Server);
	}

	getDatabaseItems(ownerUri: string): Thenable<SqlAssessmentResult> {
		return this._assessmentService.assessmentInvoke(ownerUri, AssessmentTargetType.Database);
	}
}

export class AsmtDatabaseInvokeItemsAction extends Action {
	public static ID = 'asmtaction.database.invokeitems';

	constructor(
		databaseName: string,
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(AsmtDatabaseInvokeItemsAction.ID,
			nls.localize('asmtaction.database.invokeitems', "Invoke Assessment for {0}", databaseName),
			TARGET_ICON_CLASS[AssessmentTargetType.Database]);
	}

	public async run(context: IAsmtActionInfo): Promise<boolean> {
		this._telemetryService.sendActionEvent(TelemetryView.SqlAssessment, this.id);
		if (context && context.component) {
			context.component.showProgress(AssessmentType.InvokeAssessment);
			let dbAsmtResults = await this._assessmentService.assessmentInvoke(context.ownerUri, AssessmentTargetType.Database);
			context.component.showInitialResults(dbAsmtResults, AssessmentType.InvokeAssessment);
			context.component.stopProgress(AssessmentType.InvokeAssessment);
			return true;
		}
		return false;
	}
}

export class AsmtExportAsScriptAction extends Action {
	public static ID = 'asmtaction.exportasscript';
	public static LABEL = nls.localize('asmtaction.exportasscript', "Export As Script");

	constructor(
		@IAssessmentService private _assessmentService: IAssessmentService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super(AsmtExportAsScriptAction.ID, AsmtExportAsScriptAction.LABEL, 'exportAsScriptIcon');
	}

	public async run(context: IAsmtActionInfo): Promise<boolean> {
		this._telemetryService.sendActionEvent(TelemetryView.SqlAssessment, AsmtExportAsScriptAction.ID);
		const items = context?.component?.recentResult?.result.items;
		if (items) {
			await this._assessmentService.generateAssessmentScript(context.ownerUri, items);
			return true;
		}
		return false;
	}
}

export class AsmtSamplesLinkAction extends Action {
	public static readonly ID = 'asmtaction.showsamples';
	public static readonly LABEL = nls.localize('asmtaction.showsamples', "View all rules and learn more on GitHub");
	public static readonly ICON = 'asmt-learnmore';
	private static readonly configHelpUri = 'https://aka.ms/sql-assessment-api';

	constructor(
		@IOpenerService private _openerService: IOpenerService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService

	) {
		super(AsmtSamplesLinkAction.ID, AsmtSamplesLinkAction.LABEL, AsmtSamplesLinkAction.ICON);
	}

	public async run(): Promise<boolean> {
		this._telemetryService.sendActionEvent(TelemetryView.SqlAssessment, AsmtSamplesLinkAction.ID);
		return this._openerService.open(URI.parse(AsmtSamplesLinkAction.configHelpUri));
	}
}

export class AsmtGenerateHTMLReportAction extends Action {
	public static readonly ID = 'asmtaction.generatehtmlreport';
	public static readonly LABEL = nls.localize('asmtaction.generatehtmlreport', "Make HTML Report");
	public static readonly ICON = 'bookreport';

	constructor(
		@IFileService private _fileService: IFileService,
		@IOpenerService private _openerService: IOpenerService,
		@IEnvironmentService private _environmentService: IEnvironmentService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService,
		@INotificationService private readonly _notificationService: INotificationService,
		@IFileDialogService private readonly _fileDialogService: IFileDialogService
	) {
		super(AsmtGenerateHTMLReportAction.ID, AsmtGenerateHTMLReportAction.LABEL, AsmtGenerateHTMLReportAction.ICON);
	}

	private suggestReportFile(date: number): URI {
		const fileName = generateReportFileName(new Date(date));
		const filePath = path.join(this._environmentService.userRoamingDataHome.fsPath, 'SqlAssessmentReports', fileName);
		return URI.file(filePath);
	}

	public async run(context: IAsmtActionInfo): Promise<boolean> {
		context.component.showProgress(AssessmentType.ReportGeneration);
		const choosenPath = await this._fileDialogService.pickFileToSave(this.suggestReportFile(context.component.recentResult.dateUpdated));
		context.component.stopProgress(AssessmentType.ReportGeneration);
		if (!choosenPath) {
			return false;
		}

		this._telemetryService.sendActionEvent(TelemetryView.SqlAssessment, AsmtGenerateHTMLReportAction.ID);

		const result = await this._fileService.createFile(
			choosenPath,
			VSBuffer.fromString(new HTMLReportBuilder(context.component.recentResult.result,
				context.component.recentResult.dateUpdated,
				context.component.recentResult.connectionInfo).build()),
			{ overwrite: true });
		if (result) {
			this._notificationService.prompt(Severity.Info, nls.localize('asmtaction.openReport', "Report has been saved. Do you want to open it?"),
				[{
					label: nls.localize('asmtaction.label.open', "Open"),
					run: () => {
						return this._openerService.open(result.resource.fsPath, { openExternal: true });
					}
				},
				{
					label: nls.localize('asmtaction.label.cancel', "Cancel"),
					run: () => { }
				}]);
		}
		return true;
	}
}

function generateReportFileName(resultDate): string {
	const datetime = `${resultDate.toISOString().replace(/-/g, '').replace('T', '').replace(/:/g, '').split('.')[0]}`;
	return `SqlAssessmentReport_${datetime}.html`;

}
