/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MigrationTargetType } from '../../api/utils';
import { IssueCategory } from '../../constants/helper';
import { Page, SavedInfo } from '../../models/stateMachine';

export function parseAssessmentReport(assessmentReport: any): any {
	const saveInfo: SavedInfo = {
		xEventsFilesFolderPath: null,
		collectAdhocQueries: null,
		closedPage: Page.ImportAssessment,
		databaseAssessment: [],
		databaseList: [],
		databaseInfoList: [],
		migrationTargetType: null,
		azureAccount: null,
		azureTenant: null,
		subscription: null,
		location: null,
		resourceGroup: null,
		targetServerInstance: null,
		migrationMode: null,
		networkContainerType: null,
		networkShares: [],
		blobs: [],
		targetDatabaseNames: [],
		sqlMigrationService: undefined,
		serverAssessment: null,
		skuRecommendation: null,
		serviceResourceGroup: null,
		serviceSubscription: null,
	};

	if (assessmentReport.DmaVersion !== undefined) { //DMA assessment format import
		switch (assessmentReport.TargetPlatform) {
			case "VMSqlServer": {
				saveInfo.migrationTargetType = MigrationTargetType.SQLVM;
				break;
			}
			case "ManagedSqlServer": {
				saveInfo.migrationTargetType = MigrationTargetType.SQLMI;
				break;
			}
			case "AzureSqlDatabase": {
				saveInfo.migrationTargetType = MigrationTargetType.SQLDB;
				break;
			}
			default: {
				throw new Error('Unsupported type');
			}
		}

		const serverInstance = assessmentReport.ServerInstances[0];
		saveInfo.serverAssessment = {
			issues: serverInstance.AssessmentRecommendations.map((ar: any) => {
				return {
					serverName: serverInstance.ServerName,
					rulesetVersion: "N/A",
					rulesetName: "N/A",
					ruleId: ar.RuleId,
					targetType: saveInfo.migrationTargetType,
					checkId: ar.Title,
					tags: [],
					displayName: ar.Title,
					description: ar.Recommendation,
					helpLink: ar.MoreInfo,
					level: ar.Severity,
					timestamp: "N/A",
					kind: ar.Category,
					message: ar.Impact,
					appliesToMigrationTargetPlatform: saveInfo.migrationTargetType,
					issueCategory: getIssueCategory(ar.Severity),
					impactedObjects: ar.ImpactedObjects.map((io: any) => {
						return {
							name: io.Name,
							objectType: io.ObjectType,
							impactDetail: io.ImpactDetail,
							databaseObjectType: io.DatabaseObjectType,
						}
					}),
					databaseRestoreFails: [],
				}
			}),
			databaseAssessments: assessmentReport.Databases?.map((d: any) => {
				return {
					name: d.Name,
					issues: d.AssessmentRecommendations.map((ar: any) => {
						return {
							serverName: serverInstance.ServerName,
							rulesetVersion: "N/A",
							rulesetName: "N/A",
							ruleId: ar.RuleId,
							targetType: saveInfo.migrationTargetType,
							checkId: ar.Title,
							tags: [],
							displayName: ar.Title,
							description: ar.Recommendation,
							helpLink: ar.MoreInfo,
							level: ar.Severity,
							timestamp: "N/A",
							kind: ar.Category,
							message: ar.Impact,
							appliesToMigrationTargetPlatform: saveInfo.migrationTargetType,
							issueCategory: getIssueCategory(ar.Severity),
							databaseName: d.Name,
							impactedObjects: ar.ImpactedObjects.map((io: any) => {
								return {
									name: io.Name,
									objectType: io.ObjectType,
									impactDetail: io.ImpactDetail,
									databaseObjectType: io.DatabaseObjectType,
								}
							}),
							databaseRestoreFails: [],
						}
					}),
					errors: d.Errors || [],
				};
			}),
			errors: assessmentReport.Errors ?? [],
		};
	} else { //ADS assessment format import
		const server = assessmentReport.Servers[0];
		saveInfo.serverAssessment = {
			issues: server.ServerAssessments.map((a: any) => {
				return {
					serverName: a.ServerName,
					rulesetVersion: "N/A",
					rulesetName: "N/A",
					ruleId: a.RuleMetadata.Id,
					targetType: a.AppliesToMigrationTargetPlatform,
					checkId: a.RuleMetadata.Id,
					tags: a.RuleMetadata.Tags,
					displayName: a.RuleMetadata.Id,
					description: a.RuleMetadata.Description,
					helpLink: a.RuleMetadata.HelpLink,
					level: a.RuleMetadata.Level,
					timestamp: a.Timestamp,
					kind: a.IssueCategory,
					message: a.RuleMetadata.Message,
					appliesToMigrationTargetPlatform: a.AppliesToMigrationTargetPlatform,
					issueCategory: a.IssueCategory,
					databaseName: a.DatabaseName,
					impactedObjects: a.ImpactedObjects.map((io: any) => {
						return {
							name: io.Name,
							objectType: io.ObjectType,
							impactDetail: io.ImpactDetail,
							databaseObjectType: io.DatabaseObjectType,
						}
					}),
					databaseRestoreFails: a.DatabaseRestoreFails,
				}
			}) ?? [], // server issues
			databaseAssessments: server.Databases.map((d: any) => {
				return {
					name: d.Properties.Name,
					issues: d.DatabaseAssessments.map((a: any) => {
						return {
							serverName: a.ServerName,
							rulesetVersion: "N/A",
							rulesetName: "N/A",
							ruleId: a.RuleMetadata.Id,
							targetType: a.AppliesToMigrationTargetPlatform,
							checkId: a.RuleMetadata.Id,
							tags: a.RuleMetadata.Tags,
							displayName: a.RuleMetadata.Id,
							description: a.RuleMetadata.Description,
							helpLink: a.RuleMetadata.HelpLink,
							level: a.RuleMetadata.Level,
							timestamp: a.Timestamp,
							kind: a.IssueCategory,
							message: a.RuleMetadata.Message,
							appliesToMigrationTargetPlatform: a.AppliesToMigrationTargetPlatform,
							issueCategory: a.IssueCategory,
							databaseName: a.DatabaseName,
							impactedObjects: a.ImpactedObjects.map((io: any) => {
								return {
									name: io.Name,
									objectType: io.ObjectType,
									impactDetail: io.ImpactDetail,
									databaseObjectType: io.DatabaseObjectType,
								}
							}),
							databaseRestoreFails: a.DatabaseRestoreFails,
						}
					}),
					errors: d.Errors || [],
				}
			}) ?? [], //database issues
			errors: assessmentReport.Errors ?? [],
		};
	}

	const databaseList = [];
	for (const d in assessmentReport.Databases) {
		databaseList.push(assessmentReport.Databases[d].Name);
	}
	saveInfo.databaseList = databaseList.sort();

	return saveInfo;
}

export function getIssueCategory(severity: string): string {
	switch (severity) {
		case 'Error':
			return IssueCategory.Issue;
		case 'Warning':
			return IssueCategory.Warning;
	}
	return '';
}
