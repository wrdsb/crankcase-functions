module.exports = function (context) {
    context.log('queueMessage = ', context.bindings.queueMessage);
    context.log('queueTrigger = ', context.bindingData.queueTrigger);
    context.log('expirationTime = ', context.bindingData.expirationTime);
    context.log('insertionTime = ', context.bindingData.insertionTime);
    context.log('nextVisibleTime = ', context.bindingData.nextVisibleTime);
    context.log('id = ', context.bindingData.id);
    context.log('popReceipt = ', context.bindingData.popReceipt);
    context.log('dequeueCount = ', context.bindingData.dequeueCount);

    context.log(context.bindings.originalJob);
    
    context.log(context);
    context.done();
};