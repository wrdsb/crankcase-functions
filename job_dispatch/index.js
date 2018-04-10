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
            request.post(request_options, function (error, response, body) {
                if (error) {
                    context.log('error:', error); // Print the error if one occurred
                    callback(error);
                } else {
                    context.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
                    context.log('body:', body); // Print the HTML for the Google homepage.
                    callback(null, job, response, body);
                }
            });
        },
        function(job, response, body, callback) {
            job.total_attempts = job.total_attempts + 1;
            job.updated_at = timestamp;
            if (!job.first_attempt_at) {job.first_attempt_at = timestamp;}
            job.last_attempt_at = timestamp;
        
            // success? mark job a success in table
            if (response.statusCode == 200) {
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
            var tableService = azure.createTableService();
            callback(null, tableService, job);
        },
        function(tableService, job, callback) {
            var queueService = azure.createQueueService();
            callback(null, queueService, tableService, job);
        },
        function(queueService, tableService, job, callback) {
            tableService.insertEntity('activeJobs', job, function(error, result, response) {
                if (!error) {
                    callback(null, queueService, job);
                }
            });
        },
        function(queueService, job, callback) {
            if (job.status == "success") {
                // hand off to job_callback
            } else if (job.status == "failed") {
                // hand off to failure callback
            } else {
                var queue_message = Buffer.from(job.job_number).toString('base64');
                var options = {};
                var diff = Math.abs(job.next_attempt_at - new Date());
                options.visibilityTimeout =  diff / 1000; // offset from current time, in seconds
                queueService.createMessage('jobs', queue_message, options, function(error) {
                    if (!error) {
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