using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.Extensions.Logging;
using System;
using System.Net.Http;
using System.Threading.Tasks;

namespace ADPControl
{
    public static class HttpSurface
    {
        public class ExportRequest
        {
            public Guid SubscriptionId { get; set; }

            public string ResourceGroupName { get; set; }

            public string SourceSqlServerResourceGroupName { get; set; }

            public string SourceSqlServerName { get; set; }

            public string BatchAccountUrl { get; set; }

            public string StorageAccountName { get; set; }

            public string AccessToken { get; set; }

            public string VNetSubnetId { get; set; }
        }

        public class ImportRequest
        {
            public Guid SubscriptionId { get; set; }

            public string ResourceGroupName { get; set; }

            public string TargetSqlServerResourceGroupName { get; set; }

            public string TargetSqlServerName { get; set; }

            public string TargetAccessToken { get; set; }

            public string BatchAccountUrl { get; set; }

            public string StorageAccountName { get; set; }

            public string ContainerName { get; set; }

            public string SqlAdminPassword { get; set; }

            public string VNetSubnetId { get; set; }
        }

        [FunctionName("Export")]
        public static async Task<HttpResponseMessage> PostExport(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/Export")]
            HttpRequestMessage req,
            [DurableClient] IDurableOrchestrationClient starter,
            ILogger log,
            Guid subscriptionId,
            string resourceGroupName)
        {
            log.LogInformation("C# HTTP trigger function processed an Export request.");
            ExportRequest request = await req.Content.ReadAsAsync<ExportRequest>();

            request.SubscriptionId = subscriptionId;
            request.ResourceGroupName = resourceGroupName;

            if (request.SourceSqlServerResourceGroupName == null)
                request.SourceSqlServerResourceGroupName = resourceGroupName;

            string instanceId = await starter.StartNewAsync(nameof(Orchestrator.RunExportOrchestrator), request);

            log.LogInformation($"Started orchestration with ID = '{instanceId}'.");
            return starter.CreateCheckStatusResponse(req, instanceId);
        }

        [FunctionName("Import")]
        public static async Task<HttpResponseMessage> PostImport(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = "subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/Import")]
            HttpRequestMessage req,
            [DurableClient] IDurableOrchestrationClient starter,
            ILogger log,
            Guid subscriptionId,
            string resourceGroupName)
        {
            log.LogInformation("C# HTTP trigger function processed an Import request.");
            ImportRequest request = await req.Content.ReadAsAsync<ImportRequest>();

            request.SubscriptionId = subscriptionId;
            request.ResourceGroupName = resourceGroupName;

            if (request.TargetSqlServerResourceGroupName == null)
                request.TargetSqlServerResourceGroupName = resourceGroupName;

            string instanceId = await starter.StartNewAsync(nameof(Orchestrator.RunImportOrchestrator), request);

            log.LogInformation($"Started orchestration with ID = '{instanceId}'.");
            return starter.CreateCheckStatusResponse(req, instanceId);
        }
    }
}
