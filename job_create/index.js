module.exports = function (context, data) {
    var timestamp = (new Date()).toJSON();

    context.log(data);

    if (!data.service) {
        context.done('service is required');
        return;
    }
    if (!data.operation) {
        context.done('operation is required');
        return;
    }
    if (!data.request) {
        context.done('request is required');
        return;
    }

    var job = {
        job_type: data.service + '_' + data.operation,
        job_number: context.executionContext.invocationId,
        status: "created",
        service: data.service,
        operation: data.operation,
        request: data.request,
        total_attempts: 0,
        first_attempt: null,
        last_attempt: null,
        created_at: timestamp,
        updated_at: timestamp
    };

    if (data.callback) {
        job.callback = data.callback;
    } else {
        job.callback = null;
    }

    var message = {
        job_type: job.job_type,
        job_number: job.job_number
    };

    context.bindings.jobsQueueOut = message;

    context.bindings.jobsTableOut = {
        PartitionKey: job.job_type,
        RowKey: job.job_number,
        job_type: job.job_type,
        job_number: job.job_number,
        status: job.status,
        service: job.service,
        operation: job.operation,
        request: job.request,
        callback: job.callback,
        total_attempts: job.total_attempts,
        first_attempt: job.first_attempt,
        last_attempt: job.last_attempt,
        created_at: job.created_at,
        updated_at: job.updated_at
    };

    context.done(null, 'Created job:', job);
};
