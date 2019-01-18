/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

// General Constants ///////////////////////////////////////////////////////
export const msgYes = localize('msgYes', 'Yes');
export const msgNo = localize('msgNo', 'No');

export const msgErrorLoadingTab = localize('msgErrorLoadingTab', 'An error occurred while loading the tab');
export function msgErrorLoadingView(error): string { return localize('msgErrorLoadingView', 'An error occurred while loading view: {0}', error); }
export const msgMissingSqlConnection = localize('msgMissingSqlConnection', 'No SQL connection was found');

export const SqlServerName = localize('sqlServerTypeName', 'SQL Server');

// HDFS Constants //////////////////////////////////////////////////////////
export const errDeleteConnectionNode = localize('errDeleteConnectionNode', 'Cannot delete a connection. Only subfolders and files can be deleted.');
export const lblUploadFiles = localize('lblUploadFiles', 'Upload');
export const msgDeleteFile = localize('msgDeleteFile', 'Are you sure you want to delete this file?');
export const msgDeleteFolder = localize('msgDeleteFolder', 'Are you sure you want to delete this folder and its contents?');
export const msgMissingNodeContext = localize('msgMissingNodeContext', 'Node Command called without any node passed');
export const msgSetWebHdfsHost = localize('msgSetWebHdfsHost', 'HDFS URL and port');
export const msgSetWebHdfsUser = localize('msgSetWebHdfsuser', 'User Name');

// Jupyter Constants ///////////////////////////////////////////////////////
export const lblNotebook = localize('lblNotebook', 'Notebook');
export const msgJupyterFound = localize('msgJupyterFound', '... Found Jupyter');
export const msgJupyterInstalling = localize('msgJupyterInstalling', 'Installing Jupyter...');
export const msgNotebookRunningError = localize('msgNotebookRunningError', 'This notebook is already running. Please stop the notebook before attempting to set the kernel or context');
export const msgNotebookServerStarting = localize('msgNotebookServerStarting', 'Starting Notebook server...');
export const msgStartNotebookHint = localize('msgStartNotebookHint', 'Start Notebook  Ctrl+Shift+N');
export const msgNotebookLocalContext = localize('msgNotebookLocalContext', 'Local (No Connection)');
export const msgConnectHadoopKnox = localize('msgConnectHadoopKnox', 'Connect to Hadoop Knox');
export function msgKernelFound(kernelName): string { return localize('... Found kernel: {0}', kernelName); }
export function msgKernelInstallDone(kernelName): string { return localize('... Done installing sparkmagic kernel', kernelName); }
export function msgKernelInstalling(kernelName): string { return localize('msgKernelInstalling', 'Installing {0}...', kernelName); }
export function msgKernelInstallStart(kernelName): string { return localize('... Installing kernel: {0}', kernelName); }
export const msgManagePackagesPowershell = localize('msgManagePackagesPowershell', `
<#
--------------------------------------------------------------------------------
  This is the sandboxed instance of python used by Jupyter server.
  To install packages used by the python kernel use '.\\python.exe -m pip install'
--------------------------------------------------------------------------------
#>`);
export const msgManagePackagesBash = localize('msgJupyterManagePackagesBash', `
: '
--------------------------------------------------------------------------------
  This is the sandboxed instance of python used by Jupyter server.
  To install packages used by the python kernel use './python3.6 -m pip install'
--------------------------------------------------------------------------------
'`);
export const msgManagePackagesCmd = localize('msgJupyterManagePackagesCmd', `REM  This is the sandboxed instance of python used by Jupyter server. To install packages used by the python kernel use '.\\python.exe -m pip install'`);
export const msgSampleCodeDataFrame = localize('msgSampleCodeDataFrame', 'This sample code loads the file into a data frame and shows the first 10 results.');
export const msgConnectionNotApplicable = localize('connectionNotSupported', 'n/a');
export const msgLoadingContexts = localize('loadingContexts', 'Loading contexts...');
export const msgSelectConnection = localize('selectConnection', 'Select connection');
export const msgAddNewConnection = localize('addNewConnection', 'Add new connection');


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
