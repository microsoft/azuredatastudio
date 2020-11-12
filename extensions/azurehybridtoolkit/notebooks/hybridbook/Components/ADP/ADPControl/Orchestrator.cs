using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System;
using System.Threading;
using System.Threading.Tasks;
using static ADPControl.HttpSurface;

namespace ADPControl
{
    public static class Orchestrator
    {
        // The Import Orchestrator
        [FunctionName(nameof(RunImportOrchestrator))]
        public static async Task RunImportOrchestrator(
            [OrchestrationTrigger] IDurableOrchestrationContext context, ILogger log)
        {
            log.LogInformation("RunImportOrchestrator: entering");

            try {

                ImportRequest importRequest = context.GetInput<ImportRequest>();
                // Deploy the ARM template to Create empty SQL resource
                string deploymentName = await context.CallActivityAsync<string>(nameof(AzureResourceManagerActivity.BeginDeployArmTemplateForImport), importRequest);
                while (true)
                {
                    log.LogInformation("RunImportOrchestrator: starting ARM deployment");
                    string status = await context.CallActivityAsync<string>(nameof(AzureResourceManagerActivity.GetArmDeploymentForImport), (importRequest.SubscriptionId, importRequest.TargetSqlServerResourceGroupName, deploymentName));
                    if (status == "Succeeded")
                    {
                        log.LogInformation("RunImportOrchestrator: ARM deployment succeeded");
                        break;
                    }
                    else if (status == "Failed")
                    {
                        log.LogInformation("RunImportOrchestrator: ARM deployment failed");
                        throw new Exception("Failed ARM Deployment");
                    }

                    // Orchestration sleeps until this time.
                    var nextCheck = context.CurrentUtcDateTime.AddSeconds(10);

                    if (!context.IsReplaying) { log.LogInformation($"RunImportOrchestrator: Replaying ARM deployment, next check at {nextCheck}."); }
                    await context.CreateTimer(nextCheck, CancellationToken.None);
                }

                log.LogInformation("RunImportOrchestrator: Enumerating databases");
                var databases = await context.CallActivityAsync<dynamic>(nameof(AzureResourceManagerActivity.GetArmTemplateForImportSkipParameterization), importRequest);

                // Create BatchPool And Job
                log.LogInformation("RunImportOrchestrator: Creating batch pool and import job");
                string jobId = await context.CallActivityAsync<string>(nameof(BatchActivity.CreateBatchPoolAndImportJob), importRequest);

                string containerUrl = await context.CallActivityAsync<string>(nameof(StorageActivity.GettingJobContainerUrl), (importRequest.SubscriptionId, importRequest.ResourceGroupName, importRequest.StorageAccountName, importRequest.ContainerName));

                log.LogInformation("RunImportOrchestrator: Creating import database tasks");
                BatchActivity.CreateBatchTasks("Import", jobId, containerUrl, importRequest.BatchAccountUrl, importRequest.TargetSqlServerName, importRequest.TargetAccessToken, databases, log);
                
                // create output values
                Tuple<string, string>[] outputValues = {
                    Tuple.Create("Orchestration progress:", "Complete"),
                    Tuple.Create("deploymentName", deploymentName),
                    Tuple.Create("jobId", jobId),
                    Tuple.Create("containerUrl", containerUrl)
                };
                context.SetOutput(outputValues);
            }
            finally {
                log.LogInformation("RunImportOrchestrator: exiting");
            }
        }

        // The Export Orchestrator
        [FunctionName(nameof(RunExportOrchestrator))]
        public static async Task RunExportOrchestrator(
            [OrchestrationTrigger] IDurableOrchestrationContext context, ILogger log)
        {
            ExportRequest exportRequest = context.GetInput<ExportRequest>();

            // Getting the ARM template Skip ResourceName Parameterization.
            var databases = await context.CallActivityAsync<dynamic>(nameof(AzureResourceManagerActivity.GetArmTemplateForExportSkipParameterization), exportRequest);

            // Getting the ARM template.
            dynamic Template = await context.CallActivityAsync<dynamic>(nameof(AzureResourceManagerActivity.GetArmTemplateForExport), exportRequest);
            string json = JsonConvert.SerializeObject(Template);

            // Create BatchPool And Job
            string jobId = await context.CallActivityAsync<string>(nameof(BatchActivity.CreateBatchPoolAndExportJob), exportRequest);

            string containerUrl = await context.CallActivityAsync<string>(nameof(StorageActivity.GettingJobContainerUrl), (exportRequest.SubscriptionId, exportRequest.ResourceGroupName, exportRequest.StorageAccountName, jobId));
            await context.CallActivityAsync<string>(nameof(StorageActivity.UploadingArmTemplate), (containerUrl, json));

            BatchActivity.CreateBatchTasks("Export", jobId, containerUrl, exportRequest.BatchAccountUrl, exportRequest.SourceSqlServerName, exportRequest.AccessToken, databases, log);
        
            // create output values
            Tuple<string, string>[] outputValues = {
                Tuple.Create("jobId", jobId),
                Tuple.Create("containerUrl", containerUrl)
            };
            context.SetOutput(outputValues);
        }
    }
}
