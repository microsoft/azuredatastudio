/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// HDFS Constants //////////////////////////////////////////////////////////
export const msgMissingNodeContext = localize('msgMissingNodeContext', "Node Command called without any node passed");

// HDFS Manage Access Dialog Constants ////////////////////////////////////

export const manageAccessTitle = localize('mssql.manageAccessTitle', "Manage Access");
export const locationTitle = localize('mssql.locationTitle', "Location : ");
export const permissionsHeader = localize('mssql.permissionsTitle', "Permissions");
export const ownerPostfix = localize('mssql.ownerPostfix', " - Owner");
export const owner = localize('mssql.owner', "Owner");
export const group = localize('mssql.group', "Group");
export const owningGroupPostfix = localize('mssql.owningGroupPostfix', " - Owning Group");
export const everyoneName = localize('mssql.everyone', "Everyone else");
export const userLabel = localize('mssql.userLabel', "User");
export const groupLabel = localize('mssql.groupLabel', "Group");
export const accessHeader = localize('mssql.accessHeader', "Access");
export const defaultHeader = localize('mssql.defaultHeader', "Default");
export const deleteTitle = localize('mssql.delete', "Delete");
export const stickyLabel = localize('mssql.stickyHeader', "Sticky Bit");
export const inheritDefaultsLabel = localize('mssql.inheritDefaultsLabel', "Inherit Defaults");
export const readHeader = localize('mssql.readHeader', "Read");
export const writeHeader = localize('mssql.writeHeader', "Write");
export const executeHeader = localize('mssql.executeHeader', "Execute");
export const addUserOrGroupHeader = localize('mssql.addUserOrGroup', "Add User or Group");
export const enterNamePlaceholder = localize('mssql.enterNamePlaceholder', "Enter name");
export const addLabel = localize('mssql.addLabel', "Add");
export const namedUsersAndGroupsHeader = localize('mssql.namedUsersAndGroups', "Named Users and Groups");
export const defaultUserAndGroups = localize('mssql.defaultUserAndGroups', "Default User and Groups");
export const userOrGroupIcon = localize('mssql.userOrGroupIcon', "User or Group Icon");
export const applyText = localize('mssql.apply', "Apply");
export const applyRecursivelyText = localize('mssql.applyRecursively', "Apply Recursively");

export function errorApplyingAclChanges(errMsg: string): string { return localize('mssql.errorApplyingAclChanges', "Unexpected error occurred while applying changes : {0}", errMsg); }

// Spark Job Submission Constants //////////////////////////////////////////
export const sparkLocalFileDestinationHint = localize('sparkJobSubmission.LocalFileDestinationHint', "Local file will be uploaded to HDFS. ");
export const sparkJobSubmissionEndMessage = localize('sparkJobSubmission.SubmissionEndMessage', ".......................... Submit Spark Job End ............................");
export function sparkJobSubmissionPrepareUploadingFile(localPath: string, clusterFolder: string): string { return localize('sparkJobSubmission.PrepareUploadingFile', "Uploading file from local {0} to HDFS folder: {1}", localPath, clusterFolder); }
export const sparkJobSubmissionUploadingFileSucceeded = localize('sparkJobSubmission.UploadingFileSucceeded', "Upload file to cluster Succeeded!");
export function sparkJobSubmissionUploadingFileFailed(err: string): string { return localize('sparkJobSubmission.UploadingFileFailed', "Upload file to cluster Failed. {0}", err); }
export function sparkJobSubmissionPrepareSubmitJob(jobName: string): string { return localize('sparkJobSubmission.PrepareSubmitJob', "Submitting job {0} ... ", jobName); }
export const sparkJobSubmissionSparkJobHasBeenSubmitted = localize('sparkJobSubmission.SubmitJobFinished', "The Spark Job has been submitted.");
export function sparkJobSubmissionSubmitJobFailed(err: string): string { return localize('sparkJobSubmission.SubmitJobFailed', "Spark Job Submission Failed. {0} ", err); }
export function sparkJobSubmissionYarnUIMessage(yarnUIURL: string): string { return localize('sparkJobSubmission.YarnUIMessage', "YarnUI Url: {0} ", yarnUIURL); }
export function sparkJobSubmissionSparkHistoryLinkMessage(sparkHistoryLink: string): string { return localize('sparkJobSubmission.SparkHistoryLinkMessage', "Spark History Url: {0} ", sparkHistoryLink); }
export function sparkJobSubmissionGetApplicationIdFailed(err: string): string { return localize('sparkJobSubmission.GetApplicationIdFailed', "Get Application Id Failed. {0}", err); }
export function sparkJobSubmissionLocalFileNotExisted(path: string): string { return localize('sparkJobSubmission.LocalFileNotExisted', "Local file {0} does not existed. ", path); }
export const sparkJobSubmissionNoSqlBigDataClusterFound = localize('sparkJobSubmission.NoSqlBigDataClusterFound', "No SQL Server Big Data Cluster found.");
export function sparkConnectionRequired(name: string): string { return localize('sparkConnectionRequired', "Please connect to the Spark cluster before View {0} History.", name); }
