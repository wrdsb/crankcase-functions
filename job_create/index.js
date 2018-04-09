module.exports = function (context, data) {
    var timestamp = (new Date()).toJSON();
    var response = {};

    var azure = require('azure-storage');
    var tableService = azure.createTableService();
    var queueService = azure.createQueueService();

    if (!data.service) {
        context.done('service is required');
        return;
    }
    if (!data.operation) {
        context.done('operation is required');
        return;
    }
    if (!data.payload) {
        context.done('payload is required');
        return;
    }

    var job = {
        job_number: context.executionContext.invocationId,
        job_type: data.service + ':' + data.operation,
        status: "created",
        service: data.service,
        operation: data.operation,
        request: data.payload,
        total_attempts: 0,
        max_attempts: 0,
        first_attempt_at: null,
        last_attempt_at: null,
        next_attempt_at: null,
        created_at: timestamp,
        updated_at: timestamp
    };
    job.PartitionKey = job.job_number;
    job.RowKey = 'job';

    if (data.callback) {
        job.callback = data.callback;
        response.status = 202;
    } else {
        job.callback = null;
        response.status = 200;
    }

    response.body = job;

    // Base64 encode message to keep queue happy
    var queue_message = Buffer.from(job.job_number).toString('base64');

    tableService.insertEntity('jobs', job, function(error, result, response) {
        if (!error) {
            // Only write to queue if write to table succeeded and finished.
            queueService.createMessage('jobs', queue_message, function(error) {
                if (!error) {
                    // Message inserted
                }
            });
        }
    });

    context.res = response;
    context.log(job);
    context.log(queue_message);
    context.done(null, 'Created job:', job);
};
