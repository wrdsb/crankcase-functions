module.exports = function (context, data) {
    var timestamp = (new Date()).toJSON();
    var trigger_response = {};

    var async = require('async');
    var azure = require('azure-storage');

    if (!data) {
        context.done('request body is required');
        return;
    }
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
        payload: data.payload,
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
        trigger_response.status = 202;
    } else {
        job.callback = null;
        trigger_response.status = 200;
    }

    trigger_response.body = job;
    
    // Base64 encode message to keep queue happy
    var queue_message = Buffer.from(job.job_number).toString('base64');

    context.log(job);
    context.log(queue_message);

    async.waterfall([
        function(callback) {
            context.log('start waterfall');
            callback(null, job, queue_message, trigger_response);
        },
        function(job, queue_message, trigger_response, callback) {
            var tableService = azure.createTableService();
            context.log('create table service');
            callback(null, tableService, job, queue_message, trigger_response);
        },
        function(tableService, job, queue_message, trigger_response, callback) {
            var queueService = azure.createQueueService();
            conext.log('create queue service');
            callback(null, queueService, tableService, job, queue_message, trigger_response);
        },
        function(queueService, tableService, job, queue_message, trigger_response, callback) {
            tableService.insertEntity('jobs', job, function(error, result, response) {
                if (error) {
                    callback(error);
                } else {
                    context.log('create table entry');
                    callback(null, queueService, job, queue_message, trigger_response);
                }
            });
        },
        function(queueService, job, queue_message, trigger_response, callback) {
            queueService.createMessage('jobs', queue_message, function(error) {
                if (error) {
                    callback(error);
                } else {
                    context.log('create queue entry');
                    callback(null, trigger_response);
                }
            });
        }
    ], function (err, trigger_response) {
        if (err) {
            context.done(err);
        } else {
            context.log(trigger_response);
            context.res = trigger_response;
            context.done(null, trigger_response);
        }
    });
};
