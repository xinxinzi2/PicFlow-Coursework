const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const COSMOS_CONNECTION = process.env.CosmosDBConnectionString;
const DB_DATABASE_NAME = 'PicFlowDB';
const DB_CONTAINER_NAME = 'images';

app.http('searchImages', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        // 从 URL 参数中获取搜索关键词 (例如: /api/searchImages?q=keyword)
        const keyword = request.query.get('q');
        
        context.log(`[PicFlow] 正在搜索关键词: ${keyword}`);

        try {
            const cosmosClient = new CosmosClient(COSMOS_CONNECTION);
            const container = cosmosClient.database(DB_DATABASE_NAME).container(DB_CONTAINER_NAME);

            let querySpec;

            // 如果没有关键词，就查全部；如果有，就模糊查询
            if (!keyword || keyword.trim() === "") {
                querySpec = { query: "SELECT * FROM c ORDER BY c.uploadTime DESC" };
            } else {
                // SQL: 查找 originalName 包含 keyword 的记录 (CONTAINS 忽略大小写需要配合系统函数，这里先用基础版)
                querySpec = {
                    query: "SELECT * FROM c WHERE CONTAINS(c.originalName, @keyword) ORDER BY c.uploadTime DESC",
                    parameters: [{ name: "@keyword", value: keyword }]
                };
            }

            const { resources: items } = await container.items.query(querySpec).fetchAll();
            return { status: 200, jsonBody: items };

        } catch (error) {
            context.log.error("搜索失败:", error);
            return { status: 500, body: error.message };
        }
    }
});