/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { MigrationTargetType } from '../../api/utils';
import { Page, SavedInfo } from '../../models/stateMachine';

export function parseAssessmentReport(assessmentReport: any): any {
	const saveInfo: SavedInfo = {
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
				if (assessmentReport.TargetPlatform.startsWith("SqlServer")) {
					saveInfo.migrationTargetType = MigrationTargetType.SQLDB;
				}
				saveInfo.migrationTargetType = "Unknown";
			}
		}

		saveInfo.migrationTargetType = MigrationTargetType.SQLDB; //???

		saveInfo.serverAssessment = {
			issues: assessmentReport.ServerInstances[0].AssessmentRecommendations || [],
			databaseAssessments: assessmentReport.Databases?.map((d: any) => {
				return {
					name: d.Name,
					issues: d.AssessmentRecommendations.map((ar: any) => {
						return {
							rulesetVersion: "N/A",
							rulesetName: "N/A",
							ruleId: ar.RuleId,
							targetType: "AzureSqlDatabase",
							checkId: ar.Title,
							tags: "N/A",
							displayName: ar.Title,
							description: ar.Recommendation,
							helpLink: ar.MoreInfo,
							level: ar.Severity,
							timestamp: "N/A",
							kind: ar.Category,
							message: ar.Impact,
							appliesToMigrationTargetPlatform: "AzureSqlDatabase",
							issueCategory: ar.ChangeCategory,
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

	return saveInfo;
}
