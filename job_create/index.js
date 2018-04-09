module.exports = function (context, data) {
    var timestamp = (new Date()).toJSON();
    var response = {};

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
        job_type: data.service + '_' + data.operation,
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

    var queue_message = job.job_number;

    context.bindings.jobsTableOut = job;
    context.bindings.jobsQueueOut = queue_message;
    context.res = response;
    context.log(job);
    context.log(queue_message);
    context.done(null, 'Created job:', job);
};
