const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const COSMOS_CONNECTION = process.env.CosmosDBConnectionString;

app.http('modifyImage', {
    methods: ['PATCH'],
    route: 'updateImage/{id}',
    authLevel: 'anonymous',
    handler: async (request, context) => {
        const id = request.params.id;
        const { newName } = await request.json();
        const partitionKey = "user_upload";

        try {
            const client = new CosmosClient(COSMOS_CONNECTION);
            const container = client.database("PicFlowDB").container("images");
            
            // 读取现有记录并修改
            const { resource: item } = await container.item(id, partitionKey).read();
            item.originalName = newName;
            await container.item(id, partitionKey).replace(item);

            return { status: 200, body: "更新成功" };
        } catch (error) {
            return { status: 500, body: error.message };
        }
    }
});