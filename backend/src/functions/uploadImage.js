const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { CosmosClient } = require('@azure/cosmos');

const BLOB_CONNECTION = process.env.AzureWebJobsStorage;
const COSMOS_CONNECTION = process.env.CosmosDBConnectionString;
const BLOB_CONTAINER_NAME = 'images';
const DB_DATABASE_NAME = 'PicFlowDB';
const DB_CONTAINER_NAME = 'images';

app.http('uploadImage', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`[PicFlow] 收到图片上传请求...`);

        try {
            if (!BLOB_CONNECTION || !COSMOS_CONNECTION) {
                return { status: 500, body: "配置错误，请检查 local.settings.json" };
            }

            const formData = await request.formData();
            const file = formData.get('image');
            if (!file) return { status: 400, body: "未找到文件" };

            // 1. 上传到 Blob
            const blobServiceClient = BlobServiceClient.fromConnectionString(BLOB_CONNECTION);
            const containerClient = blobServiceClient.getContainerClient(BLOB_CONTAINER_NAME);
            await containerClient.createIfNotExists({ access: 'blob' });

            const blobName = `${Date.now()}_${file.name}`;
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            const buffer = Buffer.from(await file.arrayBuffer());

            await blockBlobClient.uploadData(buffer, {
                blobHTTPHeaders: { blobContentType: file.type }
            });
            const imageUrl = blockBlobClient.url;

            // 2. 写入 Cosmos DB
            const cosmosClient = new CosmosClient(COSMOS_CONNECTION);
            const { database } = await cosmosClient.databases.createIfNotExists({ id: DB_DATABASE_NAME });
            
            // 重要修正：分区键路径改为 /partitionKey 以匹配数据对象
            const { container } = await database.containers.createIfNotExists({ 
                id: DB_CONTAINER_NAME,
                partitionKey: '/partitionKey' 
            });

            const imageItem = {
                id: blobName,
                partitionKey: "user_upload", // 数据里的 key 要对应上面的 /partitionKey
                url: imageUrl,
                originalName: file.name,
                size: buffer.length,
                uploadTime: new Date().toISOString()
            };

            const { resource: createdItem } = await container.items.create(imageItem);
            context.log(`数据库写入成功: ${createdItem.id}`);

            return {
                status: 200,
                jsonBody: { message: "上传成功", data: createdItem }
            };

        } catch (error) {
            context.error("上传流程失败:", error);
            return { status: 500, body: error.message };
        }
    }
});