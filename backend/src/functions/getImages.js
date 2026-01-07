const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const COSMOS_CONNECTION = process.env.CosmosDBConnectionString;
const DB_DATABASE_NAME = 'PicFlowDB';
const DB_CONTAINER_NAME = 'images';

app.http('getImages', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`[PicFlow] 获取图片列表...`);

        try {
            const cosmosClient = new CosmosClient(COSMOS_CONNECTION);
            const container = cosmosClient.database(DB_DATABASE_NAME).container(DB_CONTAINER_NAME);

            // SQL 查询：按时间倒序
            const querySpec = {
                query: "SELECT * FROM c ORDER BY c.uploadTime DESC"
            };

            const { resources: items } = await container.items.query(querySpec).fetchAll();
            return { status: 200, jsonBody: items };
        } catch (error) {
            context.log.error("查询失败:", error);
            return { status: 500, body: error.message };
        }
    }
});