##EZWebWorkers

This project is still in BETA and needs some extra testing before I consider it ready.

##Overview

EZWebWorkers is a static JAVASCRIPT object to simplify the use of web workers. It will create and spawn workers as needed and then manage job queues for you.

EZWebWorkers can create jobQueues that connect many workers to one queue, or you can have one queue per worker. Jobs are just data to be processed. You can add many jobs to each queue and the correct worker/s are then assigned the jobs in the order that they came in. When a worker is complete the data is returned and the job complete callback is called with the processed data. EZWebWorkers will automatic assign the next job to the worker if there are any left in the queue.

EZWebWorkers also provides a progress message callback that allows you to monitor a workers progress on a particular job, and a error callback that reports any errors encountered or thrown during the processing of the job.

##Easy to use

- There are no dependencies.
- Designed to run ES5
- Spawn workers dynamically as needed.
- Easily setup parallel processing jobs.
- Create workers, add a jobs, get a result. 

To ensure good JavaScript coding practices workers are run in strict mode. All errors (during parsing and execution) are reposted to the `errorCallback` function. It is advised that during development you provide the error callback function. DO NOT use the "window.alert" function to warn you of errors, if you are spawning many workers and jobs you may get dozens of alerts in a row that will block the page and be a real pain in the backside. 


To use download EZWebWorkers.js just include the EZWebWorkers.js file in the page.

```
    <script src="EZWebWorkers.js"></script>
```

To create a worker
runFunction
```
    var myWorker = function (){
        function workerFunction (data){ //  required function and signature. Data is the data passed to the worker when assigned a job
            var returnData;
            // .. code to process data into return Data
            
            // when done return the data
            return returnData;    
        }
    }
    // now create and spawn the worker
    var myWorkerID = EZWebWorkers.create(myWorker);  // returns the worker ID. A job queue is assigned to the worker as well

    // callback when job is done
    function myWorkerFinished(data){  // the data returned from the worker
        // do what is needed with the data
    }

    // Now add a job for the worker
    EZWebWorkers.addJob(myWorkerID, dataToProcess, myWorkerFinished);

```

As easy as that. The worker will process that data and then the myWorkerFinished call back is called when the worker has finished processing the data.

##Parallel processing

If you have data that can be processed in parallel it is easy to spawn many workers to handle one work queue.

```
    var myJobQueue = EZWebWorkers.createJobQueue(); // create a job queue    
    var myWorkerID; 
    const numberOfConcurentWorkers = 8; // number of workers that you want working at once.
    for(var i = 0; i < numberOfConcurentWorkers; i ++){        
        // To access the queue you need the ID of any one of the assigned workers. To make the code easy I just
        // assign worker IDs as they come keeping the last to use as a reference to the queue
        myWorkerID = EZWebWorkers.create(myWorker, myJobQueue, myWorkerFinished);  // create the worker attached to the created queue
    }
    
    // now add 1000 jobs to be processed.
    const numberJobs = 1000;
    for(i = 0; i < numberJobs; i++){
        // add the jobs to the queue
        EZWebWorkers.addJob(myWorkerID,data[i]);
    }
```


All free workers will be given the jobs from the queue. When a worker has finished a job and there are more jobs on the queue it is given the next job. All workers will be kept busy till all jobs are done.
    
Important NOTE. Even though jobs will always be handed to workers in the order they are placed on the job queue, some job may take longer than others to complete. This means that the job complete callback may not be called in the order of the jobs assigned. You should include in the data you pass to the worker via the queue some information regarding the context of the job. See the examples for morte information.

###Transferable data
Some data types in javascript are transferable. Typed arrays area an example of transferable data. If you wish data to be exchanged via the transferable protocol you should mark the data as transferable in the data you seen.

Note that transferred data is removed from the sender and no longer available.
Note that transferred data once received can not be transferred but must be redefined as a transferable object.
EG
```
    // send a transferable array to a worker
    // Assuming a worker has been created and is running
    var myData = new Uint8Array(512 * 512 * 4); // create a pixel buffer
    fillWithPixels(myData);  // put data in the array
    EZWebWorkers.addJob(workerID, {transfer : myData.buffer});
    console.log("myData.length = " + myData.length); // myData.length = 0
       
```

At the worker the data is received in the transfer property of the data.

```
    workerFunction(data){
         var pixelData = data.transfer; // note it is a arrayBuffer and can not be accessed unless you convert it to an typed array 
    }
```    
To resend the data as a transferable object you need to redefine the data as a transferable object.

```
    workerFunction(data){
         var pixelData = new Uint8Array(data.transfer);
         // do work on the pixel data
         return {transfer : pixelData.buffer}
    }
```
Note that there is not error checking currently for transferable. I am not entirely happy with the different browsers, in particulate with Chrome running out of memory when using transferable arrays. 

##A word on Multi threading.

Each worker when created gets its own context and thread. They can only share data via the messaging API which is hidden from the EZWebWorkers API. 

Workers provide two advantages over using the main Javascript context (on the page).
- Workers run on a separate threads. If the hardware has multiple cores (CPUs) you can process data in parallel. For example a modern PC can have 8 (or more) cores allowing you to process data 8 times as quickly. 
 But be aware that creating more workers than there are cores will not give a extra performance, as each worker must share the processing time between all the threads. Thus on a PC with 8 core you start up 16 workers the overall processing time may be lower than using 8 as the over head of switching between threads, the extra memory, etc will reduce the amount of CPU cycles available to the workers. 
 Also note that your page is not the only process running on the device. Just because a device has many cores they may be used by other applications and must be shared.
- Workers are non blocking. When the worker is processing data, it does not block the pages, allowing the user to still interact with the page.

**Warning** Each thread consumes extra CPU power, and thus power. Machines that rely on batteries can have the battery drained very quickly when using web workers. It can also cause the machine to heat up, making it turn on its fans further reducing battery life. If you intend to use workers for extended time to process data you should give the user some warning and provide options to use fewer threads. You may also want to include some processing breaks to allow the device to cool down.  

        
##The EZWebWorkers API

EZWebWorkers has the following interface. Note arguments inside [ ] are optional

- **create(func, [jobQueue], [completeCallback], [progressCallback], [errorCallback], [closeCallback])**
- **createQueue()**
- **addJob(workerID, data, [callbackResult], [progressCallback], [errorCallback])**
- **cancelJobs(workerID)**
- **close(workerID, [forceClose])**
- **shutDown([workerID])**


###create(func, [options])

Creates a worker from a function and returns a workerID. The workerID is used to assign jobs, close and shutdown the worker.

Arguments

- **func** The function from which to create a worker from. EZWebWorkers will extract the contained workerFunction and span a worker from the source code. You can not immediately invoke code, to have any code run you must pass a job to the worker.
- **[options]** Options is optional. IF given it can contain the following properties.

####options properties
All properties are optional

- **jobQueue** Optional if not supplied a new job queue is created for the worker. If you have work that needs to be done in parallel you can create a separate job queue. All workers with the same job queue will be given jobs from that queue. To access a job queue you need the ID of one of the workers on the queue.
- **completeCallback** Optional. The callback function that is called when a job is complete. If not supplied then you must specify the completeCallback when you add a job to the job queue. Teh callback function receives one argument. `function myCompleteteCallback(data){` which is the data returned by the worker function.
- **progressCallback** Optional. This callback is not required. If supplied it is called when ever the worker function sends a progress message. The callback takes the form of function `myProgressCallback(progress)` the argument progress can be anything you wish. To send a progress message from the worker just call `progressMessage(progValue)` and the `progressCallback` if assigned a function will automatically be called with the argument `progValue`. You may wish to use the progress callback to pass interim data.
- **errorCallback** Optional. If given this callback is called if there is an error thrown by the worker. The callback takes the form `errorCallback(workerID, error)`  where workerID is the ID of the worker and `error` is the error object thrown. 
 NOTE that when a worker has thrown an error it is assumed that it can no longer function correctly. The worker will automatically be shutdown and will not be available for any further jobs. All data processed by the worker for the current job will be lost.
- **closeCallback** Optional. If given this callback is called when the worker closes.The callback function takes the form `workerClosingCallback(workerID, EZWebWorkersReference)` where workerID is the ID of the closed worker and `EZWebWorkersReference` is just a reference to the EZWebWorker API
 Note the reference to the API for this callback is there currently as legacy support (From when EZWebWorkers was a dynamicly created object) and may be removed at any time. If you need to access the API do it directly with `EZWebWorkers`
- **readyCallback** Optional. Is called when the worker reports ready status.

###createQueue()
Returns a queue object. If you have a parallel processing job you will need to have many workers assigned to the same job queue. Use this function to create a queue and pass it as the second argument when creating a worker (see EZWebWorkers.create for more info).

###addJob(workerID, data, [callbackResult], [progressCallback], [errorCallback])
Adds a job to a workers job queue.

Note that the callbacks if supplied are only for this new job. If the worker was assigned callbacks when created the callback given in this function will be called instead of the previously assigned callbacks. If the next job is not given any callbacks then the callbacks (if any) assigned at create will be called.
- **workerID** the ID of a worker. If the worker is sharing a work queue then any of the workers on that queue may be assigned the job. If all workers are busy the job will wait until the first noon busy worker and assign the job to that worker. you can place as many jobs as you like on the queue (within memory constraints that is). Jobs will be assigned to workers in the order that they have been added.
- **completeCallback** optional. See EZWebWorkers.create for details 
- **progressCallback** optional. See EZWebWorkers.create for details 
- **errorCallback** optional. See EZWebWorkers.create for details 

###cancelJobs(workerID)
Cancels all pending jobs on the job queue associated with the worker with workerID. If the worker can not be found nothing is done. Else the job queue is emptied and true is returned.

Note that all work currently being processed by the workers will still be completed.

**Warning** If you have issued a close command to a worker the call cancelJobs will also cancel the close command.

###close(workerID, [forceClose])
Close a worker when it is no longer busy. If the worker is busy, the close command is placed on the workers private queue. It will take priority over any jobs on the jobQueue, shared or not and be issued as soon as the worker is free to handle messages. If the worker is not busy then the close message is sent immediately.

When a worker has been closed it is no longer available for any further jobs. 

To close the worker must negotiate the close command with EZWebWorkers to ensure a clean shutdown (done automatically for you). EZWebWorkers will wait for the worker to respond to the close command and if supplied will call the `closeCallback`. When tyhe close callback is called the worker will already have closed.

Note. When the close command is is issued the worker will still complete the current job before closing.

- **workerID** The ID of the worker to shut down. If the worker matching the ID can not be found the close command is ignored and the function will return `false`. If the worker is found then the close command will be issued and the function will return `true`.
- **forceClose** Optional. If this is true then the close command will be sent immediately, by passing the queue. The current job will still be finished befor the worker will close.

###shutDown([workerID])
Shutdown the worker now. There is no negotiation, the worker is terminated immediately. If busy all work will be lost. The closeCallback (if available) will not be called. When this function returns the worker will no longer exist.

- **workerID** Optional. The ID of the worker to terminate. If the worker can not be found then nothing will be done. If workerID is not supplied then all workers will be terminated.  
 
##The worker function.

The worker function is contains the source code to run as a worker.

Example worker function

```
    var myWorker = function (){
        // worker source starts here, the first line after the function declaration
        function workerFunction (data){ //  required function and signature. Data is the data passed to the worker when assigned a job
            var returnData;
            // .. code to process data into return Data
            
            // when done return the data
            return returnData;    
        }

        // worker source ends here, the first line before the closing block
    }
```

The worker must include the function `workerFunction(data)` as this is the entry point when a job is started.

EZWebWorkers extracts the code from within the function body and creates the worker from that code. Added to that code is code that helps EZWebWorkers manage the worker.

These include some variables and function that you can use.

```
    var isWorker = true;   // flag to indicate that the function is a worker
    
    var workerID = 'wUID_9561082740';  // a unique worker ID
    
    // Call this function to send a progress report to the main javascript context.
    var progressMessage = function(data) {
        postMessage({type : "Progress", id : workerID, progress : data});
    }    
``` 



###Important changes

**19 Jan 2017** 
Added worker ready callback that is called with the workerID as first argument when worker reports ready.
EZWebWrokers.create(workerFuncContainer,options) Changed and now has two arguments the first is the worker function and the second is options. Options is optional. Options contains
- jobQueue : /* a valid job queue or leave undefined */,
- readyCallback : /* function called when worker reports ready */
- completeCallback : /* function called when a worker has completed a job */
- progressCallback : /* function called when a worker send a progress message */
- errorCallback : /* function called when there is an error that prevents the worker from completing a job */ NOTE that returning true from this callback will force the worker to close (if it can) returning anything !== true will try to keep the worker alive. You will have to make sure you shut down the worker yourself.
- closeCallback : /* function called when worker has sent a acknowledgement of clean shutdown and been shutdown */
      



 
###Status

I have limited resources (one worn out old laptop) so can only test Edge, Firefox, & Chrome on windows10. When I have completed testing on some more devices and browsers I will consider it ready.

 
 
 
 