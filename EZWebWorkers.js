
var EZWebWorkers = (function(){
    const ids = new Set();          // List of IDs
    const ID_PREFIX = "wUID_";
    const workers = {};             // contains workers
    /* This was to be used to load balance to client core count but causes Firefox to throw error
    const concurrency =  window.clientInformation && window.clientInformation.hardwareConcurrency ? window.clientInformation.hardwareConcurrency : 1;
    */
    const ID_LENGTH = 10;           // length of random ID
    const RESPOND_TIMEOUT = 2000;   // How long to wait for response after error
                                    // Worker is terminated if it times out.
                                    
    //**************************************************************************                                
    // convert function to a string removing the function token and first and 
    // last {} are removed
    function functionToString (func) {
        var i,str;
        str = func.toString();
        str = str.replace("function ()","");
        i = 0; 
        while(str[i++] !== "{");
        str = str.substr(0, i - 1) + str.substr(i + 1);
        i = str.length - 1; 
        while(str[i--] !== "}");
        str = str.substr(0, i + 1) + str.substr(i + 2);
        return str;        
    }
    //**************************************************************************
    // This function contains functions that are added to the worker function.
    // Contains onmessage event listener. Function progressMessage that is used
    // by the worker to send progress reports if needed.
    // last line is `postMessage({type:"System",id:workerID,message:"OK"})`
    // Indicates that the worker has been parsed and is ready to run.
    // NOTE that workerCom is a String not a function, but has been parsed as
    // valid javascript.
    const workerCom = functionToString(function (){
        onmessage = function(e){
            var type = e.data.type;
            if (type === undefined) {
                postMessage({type : "System", id : workerID, message : "Unknown message"});
            }else if (type === "System") {
                if(e.data.message === "Close") {
                    postMessage({type : "System", id : workerID, message : "Closing"});
                    close();
                }else if(e.data.message === "?") {
                    postMessage({type : "System", id : workerID, message : "Alive"});
                }
            }else if (type === "Run") {
                postMessage({type : "Result", id : workerID, result : workerFunction(e.data.args)});
            }
        }
        var progressMessage = function(p) {
            postMessage({type : "Progress", id : workerID, progress : p});
        }
        postMessage({type : "System", id : workerID, message : "OK"});
    });
    //**************************************************************************
    // generates a random unique ID prefixed with ID_PREFIX
    function getID(){
        var i,id,finding;
        finding = true;  // just in case there is a duplicate
        while(finding){
            id = ID_PREFIX;
            i = ID_LENGTH;
            while(i > 0){
                id += Math.floor(Math.random() * 10);
                i -= 1;
            }
            finding = !ids.has(id)?false:true;
        }
        ids.add(id);
        return id;
    }
    //**************************************************************************
    // After a worker has been closed or terminated this is called to 
    // remove the worker from any shared queues.
    function removeWorkerFromQueues(workerID){
        for(var i in workers){
            if(workers[i] !== undefined){
                var index = workers[i].jobQueue.workers.indexOf(workerID);
                if(index !== -1){
                    workers[i].jobQueue.workers.splice(index,1);
                }
            }
        }    
    }
    //**************************************************************************
    // handles errors. If the worker has not reported ready then it is
    // assumed there is a parsing error.Report the error in the log
    // and terminate the worker
    // If the worker is busy then call the error callback
    // if the errorcallback returns true the terminate the worker
    // if the callback is undefined then ping the worker 
    function workerError(e){
        var id,worker;
        worker = e.target;
        if(worker.ready){
            if(worker.busy){
                if(worker.errorCallback !== undefined){
                    if(worker.errorCallback(worker.id,e)){
                        shutDown(worker.id);
                        return;
                    }
                } else if(worker.callbacks.error !== undefined){
                    if(worker.callbacks.error(worker.id, e)){
                        shutDown(worker.id);
                        return;
                    }
                    
                }
                worker.postMessage({type:"System",message:"?"});
                worker.waitHandle = setTimeout(function(){
                    shutDown(worker.id);
                },RESPOND_TIMEOUT)
            }
            
        }else{
            shutDown(worker.id);
        }
    }
    //**************************************************************************
    // handle incoming messages
    function workerMessage (e) {
        var type, id, message,worker;
        type = e.data.type;
        id = e.data.id;
        // check if there are more jobs on the quew and start them if there are
        function nextJob () {
            var job;
            if(worker.jobQueue.queue.length > 0){
                job = worker.jobQueue.queue.shift(); // get next job;
                if (job.close) {            // is it a close command
                    close(job.who, true);   // force worker to close
                } else {                    // just a normal job send it.
                    worker.postMessage({type : "Run", args : job.args});
                    worker.completeCallback = job.completeCallback;
                    worker.progressCallback = job.progressCallback;   
                    worker.errorCallback = job.errorCallback;
                    worker.busy = true;
                }
            } else {  // no jobs so flag worker as not busy
                worker.busy = false;
            }
        }
        if (type === undefined || !ids.has(id)) {
            return; // ignor messages with incorrect id
        }else{
            worker = workers[id];
            if (worker === undefined) {
                return; // ignor messages if there is no worker with that id
            }
            if (type === "System") {
                message = e.data.message;
                if (message === "OK") {
                    worker.ready = true;
                    nextJob();
                } else if (message === "Closing") {
                    if(typeof worker.callbacks.closed === "function"){
                        worker.callbacks.closed(id,API);
                    }
                    workers[id] = undefined; // dereference worker.
                    removeWorkerFromQueues(id);
                } else if (message === "Alive") { // System may query workers status when there 
                                               // is a slow down for what ever reason.
                                               // this message is returned by worker to indicate
                                               // it is still alive
                    if (worker.waitHandle !== undefined) {
                        clearTimeout(worker.waitHandle);
                        worker.waitHandle = undefined;
                    }
                    nextJob();
                }
            } else if(type === "Result"){  // a result has been returned call the callback
                if(typeof worker.completeCallback === "function"){
                    worker.completeCallback(e.data.result,id,API);
                }else if(typeof worker.callbacks.complete === "function"){
                    worker.callbacks.complete(e.data.result,id,API);
                }
                nextJob();         // check for another job
            } else if(type === "Progress"){ // progress message
                if(typeof worker.progressCallback === "function"){  // is there a progress callback
                    worker.progressCallback(e.data.progress); // call it
                }else if(typeof worker.callbacks.progress === "function"){
                    worker.callbacks.progress(e.data.result,id,API);
                }
            }
        }
    }
    //**************************************************************************
    // creates a new worker from the function func.
    // Example function 
    /***************************************************************************
        var myWorker = function (){  // worker wrapper
            // add worker global code here
            const someNumber = 0;
            // the following function name is required and has one argument data
            function workerFunction(data){    //required the function to run
                                           // data is the data passed to worker
                // code here
                // workers can access the following
                progressMessage(0.5); // send a message half done.
                console.log(isWorker); // I am a worker
                console.log(workerID);    // 
      
                // when the worker is done return the data
                return returnData;        // the returned data
            }
        }                                             
    ****************************************************************************/
    // You may want to have many workers share a job. To do this create a jobQueue
    // with the function createQueue and pass the queue as the second argument
    // for all workers you want to share jobs with.
    // Callbacks are optional
    function createWorker(func,jobQueue,completeCallback,progressCallback,errorCallback,closeCallback){
        var URL, blob, BlobBuilder, functionStr, id, worker;
        id = getID();
        // create worker source code string.
        functionStr = '"use strict";\n' + "var isWorker = true;\n var workerID = '" + id + "';\n";
        functionStr += functionToString(func); 
        functionStr += "\n";
        functionStr += workerCom;
        URL = window.URL || window.webkitURL;
        if (typeof Blob === 'function') {
            blob = new Blob([functionStr], {type : 'application/javascript'});
        } else {
            BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
            blob = new BlobBuilder();
            blob.append(functionStr);
            blob = blob.getBlob();
        }
        worker = new Worker(URL.createObjectURL(blob));
        worker.addEventListener("message", workerMessage);
        worker.addEventListener("error", workerError);
        worker.jobQueue = jobQueue !== undefined && jobQueue !== null ? jobQueue : {queue : [], workers : []};
        worker.jobQueue.workers.push(id);
        worker.callbacks = {
            complete : completeCallback,
            progress : progressCallback,
            error : errorCallback,
            closed : closeCallback,
        };
        worker.busy = false;
        worker.id = id;
        workers[id] = worker;
        return id;
    }
    //**************************************************************************
    // Create a common job queue to hold pending jobs for workers
    function createJobQueue(){
        return {
            queue : [],
            workers : [],
        }
    }
    //**************************************************************************
    // give the worker a job.
    // workerID is the worker ID. If the worker is sharing a queue then
    // workerID can be any of the workers on that queue
    // data is the arguments to send to the worker
    // All callbacks are optional.
    // callbackResult is the callback that is called when a result is returned
    //         the callback takes one argument that is the data returned from the worker
    // pCallback is the progress callback
    //         the progress callback takes one argument that is the progress 
    //         ranged from 0 to 1
    // errorCallback is called if there is an error
    //
    // will return false if worker ID is unknown or worker does not exist.
    function run(workerID,data,callbackResult,progressCallback,errorCallback){
        var worker,i,workerRef;
        workerRef = workers[workerID];
        if(workerRef === undefined){  // is there a worker??
            return false;
        }
        for(i = 0; i < workerRef.jobQueue.workers.length; i++){
            worker = workers[workerRef.jobQueue.workers[i]];
            if(worker !== undefined){  // is there a worker??
                if(worker.ready && !worker.busy){
                    worker.postMessage({type:"Run",args:data}); // send run command and data
                    worker.completeCallback = callbackResult;  // set the callbacks
                    worker.progressCallback = progressCallback;
                    worker.errorCallback = errorCallback;
                    worker.busy = true;   // flag as busy
                }
            }
        }
        workerRef.jobQueue.queue.push({
            args : data,
            completeCallback : callbackResult,
            errorCallback : errorCallback,
            progressCallback : progressCallback,
        });
        return true; 
    }
    //**************************************************************************
    // Removes any remaining jobs on the job queue associated with the workerID
    // If workerID can not be found then nothing is done and false returned;
    function cancelJobs(workerID){
        var worker = workers[workerID];
        if(worker === undefined){
            return false;
        }
        worker.jobQueue.queue.length = 0;
        return true;
    }
    //**************************************************************************
    // request the worker to close.
    // workerID is the workers ID
    // forceClose if true send close message now. Work will close as soon as able
    // if forceClose not true
    // The worker will not close if it is busy or if it has not reported it is ready
    // The close command will be added to the end of the job quew.
    // This function returns false if the worker could not be found.
    //               return true if the worker could be found.
    function close(workerID, forceClose){
        var worker = workers[workerID];
        if(worker === undefined){
            return false;
        }
        if(forceClose !== true && (worker.busy || !worker.ready)){  // worker is busy so put close command at the end of the line.
            worker.jobQueue.queue.push({close:true , who : workerID});            
        }else{
            worker.postMessage({type:"System",message:"Close"});
        }
        return true;
    }
    //**************************************************************************
    // shutdown worker now. Does not care if the worker is busy or ready
    // Does not send a message just terminates it
    // workerID the ID of the worker to terminate
    // if workerID is undefined then shutsdown all workers.
    // does not throw if bad reference
    function shutDown(workerID){
        var i,worker;
        if(workerID === undefined){
            for(i in workers){
                worker = workers[i];
                if(worker !== undefined){
                    worker.terminate();
                    workers[i] = undefined;
                }
            }
            return;
        }
        worker = workers[workerID];
        if(worker !== undefined){
            worker.terminate();
            workers[workerID] = undefined;
            removeWorkerFromQueues(workerID);
        }
    }
    //**************************************************************************
    // workerManager API 
    var API;
    return API = {
        create : createWorker,
        createQueue : createJobQueue,
        addJob : run,
        cancelJobs : cancelJobs,
        close: close,
        shutDown : shutDown,
    }
})()


