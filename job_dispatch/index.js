module.exports = function (context) {
    var timestamp = (new Date()).toJSON();
    var queue_message = context.bindings.queueMessage;
    var job =  context.bindings.originalJob;

    var request = require('request');
    var azure = require('azure-storage');
    var tableService = azure.createTableService();
    var queueService = azure.createQueueService();

    var service = job.service;
    var operation = job.operation;
    var service_key = '';

    switch (service) {
        case 'wrdsb-igor':
            service_key = process.env['igor_key'];
            break;    
        default:
            break;
    }

    var request_options = {
        method: 'POST',
        url: `https://${service}.azurewebsites.net/api/${operation}?code=${service_key}&clientId=crankcase`,
        headers: {
            'User-Agent': 'wrdsb-crankcase'
        },
        json: job.payload
    };

    request.post(request_options, function (error, response, body) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log('body:', body); // Print the HTML for the Google homepage.
    });

    //context.log('queueTrigger = ', context.bindingData.queueTrigger);
    //context.log('expirationTime = ', context.bindingData.expirationTime);
    //context.log('insertionTime = ', context.bindingData.insertionTime);
    //context.log('nextVisibleTime = ', context.bindingData.nextVisibleTime);
    //context.log('id = ', context.bindingData.id);
    //context.log('popReceipt = ', context.bindingData.popReceipt);
    //context.log('dequeueCount = ', context.bindingData.dequeueCount);
    
    // if success: call callback

    // else failure: re-queue

    context.done();
};