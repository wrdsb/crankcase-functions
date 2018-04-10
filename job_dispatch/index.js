module.exports = function (context) {
    var timestamp = (new Date()).toJSON();
    var queue_message = context.bindings.queueMessage;
    var job =  context.bindings.originalJob;

    var async = require('async');
    var request = require('request');
    var azure = require('azure-storage');
    var tableService = azure.createTableService();
    var queueService = azure.createQueueService();

    var service = job.service;
    var operation = job.operation;
    var service_key = '';
    var payload = JSON.parse(job.payload);

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
            'Content-Type':'application/json',
            'Accept':'application/json',
            'User-Agent': 'wrdsb-crankcase'
        },
        json: payload
    };

    async.waterfall([
        function(callback) {
            callback(null, job, request_options);
        },
        function(job, request_options, callback) {
            job.total_attempts = job.total_attempts + 1;
            job.updated_at = timestamp;
            if (!job.first_attempt_at) {job.first_attempt_at = timestamp;}
            job.last_attempt_at = timestamp;

            var api_result = request.post(request_options, function (error, response, body) {
                context.log('error:', error);
                context.log('statusCode:', response && response.statusCode);
                context.log('body:', body);
                return {error: error, response: response, body: body};
            });
            callback(null, job, api_result);
        },
        function(job, api_result, callback) {
            // success? mark job a success in table
            if (api_result.response.statusCode == 200) {
                job.status = "success";
            // else fail or re-queue
            } else {
                // out of retries? mark failed
                if (job.max_attempts != 0 && job.total_attempts >= job.max_attempts) {
                    job.status = "failed";
                    job.next_attempt_at = null;
                // else requeue
                } else {
                    job.status = "pending";
                    var next_attempt = new Date();
                    switch (total_attempts) {
                        case 1:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 1);
                            break;
                        case 2:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 2);
                            break;
                        case 3:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 5);
                            break;
                        case 4:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 10);
                            break;
                        case 5:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 15);
                            break;
                        case 6:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 20);
                            break;
                        case 7:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 30);
                            break;
                        case 8:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 45);
                            break;
                        default:
                            job.next_attempt_at = next_attempt.setMinutes(next_attempt.getMinutes() + 60);
                            break;
                    }
                }
            }
            callback(null, job);
        },
        function(job, callback) {
            tableService.replaceEntity('activeJobs', job, function(error, result, response) {
                if (error) {
                    callback(error);
                } else {
                    callback(null, job);
                }
            });
        },
        function(job, callback) {
            // If job has run its course, hand off to job_callback
            if (job.status == "success" || job.status == "failed") {
                var queue_message = Buffer.from(job.job_number).toString('base64');
                queueService.createMessage('callbacks', queue_message, function(error) {
                    if (error) {
                        callback(error);
                    } else {
                        callback(null, job);
                    }
                });
            // else, requeue
            } else {
                var queue_message = Buffer.from(job.job_number).toString('base64');
                var options = {};
                var diff = Math.abs(job.next_attempt_at - new Date());
                options.visibilityTimeout =  diff / 1000; // offset from current time, in seconds
                queueService.createMessage('jobs', queue_message, options, function(error) {
                    if (error) {
                        callback(error);
                    } else {
                        callback(null, job);
                    }
                });
            }
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