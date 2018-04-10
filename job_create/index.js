module.exports = function (context) {
    var timestamp = (new Date()).toJSON();
    var job_request = context.bindings.queueMessage;

    var async = require('async');
    var azure = require('azure-storage');

    if (!job_request.service) {
        context.done('service is required');
        return;
    }
    if (!job_request.operation) {
        context.done('operation is required');
        return;
    }
    if (!job_request.payload) {
        context.done('payload is required');
        return;
    }

    var job = {
        job_number: context.executionContext.invocationId,
        job_type: job_request.service + ':' + job_request.operation,
        status: "created",
        service: job_request.service,
        operation: job_request.operation,
        payload: JSON.stringify(job_request.payload),
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

    if (job_request.callback) {
        job.callback = job_request.callback;
    } else {
        job.callback = null;
    }

    context.log(job);

    async.waterfall([
        function(callback) {
            callback(null, job);
        },
        function(job, callback) {
            var tableService = azure.createTableService();
            tableService.insertEntity('activeJobs', job, function(error, result, response) {
                if (error) {
                    callback(error);
                } else {
                    callback(null, job);
                }
            });
        },
        function(job, callback) {
            // Base64 encode message to keep queue happy
            var queue_message = Buffer.from(job.job_number).toString('base64');
            var queueService = azure.createQueueService();
            queueService.createMessage('jobs', queue_message, function(error) {
                if (error) {
                    callback(error);
                } else {
                    callback(null, job);
                }
            });
        }
    ], function (err, job) {
        if (err) {
            context.done(err);
        } else {
            context.done(null, job);
        }
    });
};
