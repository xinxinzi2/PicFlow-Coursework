const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { BlobServiceClient } = require('@azure/storage-blob');

const COSMOS_CONNECTION = process.env.CosmosDBConnectionString;
const BLOB_CONNECTION = process.env.AzureWebJobsStorage;

app.http('deleteImage', {
    methods: ['DELETE'],
    route: 'deleteImage/{id}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const id = request.params.id;
        const partitionKey = "user_upload"; // 对应你设计的分区键 [cite: 238]

        try {
            // 1. 删除数据库记录
            const client = new CosmosClient(COSMOS_CONNECTION);
            const container = client.database("PicFlowDB").container("images");
            await container.item(id, partitionKey).delete();

            // 2. 删除存储中的 Blob 文件
            const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION);
            const containerClient = blobServiceClient.getContainerClient("images");
            const blockBlobClient = containerClient.getBlockBlobClient(id);
            await blockBlobClient.deleteIfExists();

            return { status: 200, body: "删除成功" };
        } catch (error) {
            context.log.error("删除失败:", error);
            return { status: 500, body: error.message };
        }
    }
});