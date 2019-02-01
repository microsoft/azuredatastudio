/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// HDFS Constants //////////////////////////////////////////////////////////
export const msgMissingNodeContext = localize('msgMissingNodeContext', 'Node Command called without any node passed');
export const msgTimeout = localize('connectionTimeout', 'connection timed out. Host name or port may be incorrect');
export const errDeleteConnectionNode = localize('errDeleteConnectionNode', 'Cannot delete a connection. Only subfolders and files can be deleted.');


// General Constants ///////////////////////////////////////////////////////
export const msgYes = localize('msgYes', 'Yes');
export const msgNo = localize('msgNo', 'No');

// Spark Job Submission Constants //////////////////////////////////////////
export function submitSparkJobWithJobName(jobName: string): string { return localize('sparkJobSubmission_SubmitSparkJob', '{0} Spark Job Submission:', jobName); }
export const sparkSelectLocalFile = localize('sparkSelectLocalFile', 'Select');
export const sparkLocalFileDestinationHint = localize('sparkJobSubmission_LocalFileDestinationHint', 'Local file will be uploaded to HDFS. ');
export function sparkGetLocalFileDestinationWithPath(path: string): string { return localize('sparkJobSubmission_LocalFileDestinationHintWithPath', 'The selected local file will be uploaded to HDFS: {0}', path); }
export const sparkJobSubmissionStartMessage = localize('sparkJobSubmission_SubmissionStartMessage', '.......................... Submit Spark Job Start ..........................');
export const sparkJobSubmissionEndMessage = localize('sparkJobSubmission_SubmissionEndMessage', '.......................... Submit Spark Job End ............................');
export function sparkJobSubmissionPrepareUploadingFile(localPath: string, clusterFolder: string): string { return localize('sparkJobSubmission_PrepareUploadingFile', 'Uploading file from local {0} to HDFS folder: {1}', localPath, clusterFolder); }
export const sparkJobSubmissionUploadingFileSucceeded = localize('sparkJobSubmission_UploadingFileSucceeded', 'Upload file to cluster Succeeded!');
export function sparkJobSubmissionUploadingFileFailed(err: string): string { return localize('sparkJobSubmission_UploadingFileFailed', 'Upload file to cluster Failed. {0}', err); }
export function sparkJobSubmissionPrepareSubmitJob(jobName: string): string { return localize('sparkJobSubmission_PrepareSubmitJob', 'Submitting job {0} ... ', jobName); }
export const sparkJobSubmissionSparkJobHasBeenSubmitted = localize('sparkJobSubmission_SubmitJobFinished', 'The Spark Job has been submitted.');
export function sparkJobSubmissionSubmitJobFailed(err: string): string { return localize('sparkJobSubmission_SubmitJobFailed', 'Spark Job Submission Failed. {0} ', err); }
export const sparkJobSubmissionSubmitJobFailedWithoutErr = localize('sparkJobSubmission_SubmitJobFailedWithoutErr', 'Spark Job Submission Failed.');
export function sparkJobSubmissionYarnUIMessage(yarnUIURL: string): string { return localize('sparkJobSubmission_YarnUIMessage', 'YarnUI Url: {0} ', yarnUIURL); }
export function sparkJobSubmissionSparkHistoryLinkMessage(sparkHistoryLink: string): string { return localize('sparkJobSubmission_SparkHistoryLinkMessage', 'Spark History Url: {0} ', sparkHistoryLink); }
export function sparkJobSubmissionTrackingLinkMessage(link: string): string { return localize('sparkJobSubmission_SparkTrackingLinkMessage', 'Tracking Url: {0} ', link); }
export function sparkJobSubmissionGetApplicationIdFailed(err: string): string { return localize('sparkJobSubmission_GetApplicationIdFailed', 'Get Application Id Failed. {0}', err); }
export function sparkJobSubmissionLocalFileNotExisted(path: string): string { return localize('sparkJobSubmission_LocalFileNotExisted', 'Local file {0} does not existed. ', path); }

