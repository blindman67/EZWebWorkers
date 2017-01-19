var restartFunction;
function mandelbrotExample(){
    
    
    var stop = false;
    var restartCallback;
    var updateDisplay = true;
    var status = document.getElementById("statusText");
    // details of the Mandelbrot view
    var view = {
        start : {
            x : (-2.5 + 1)/2 - 1.75 * (canvas.width /canvas.height) * 0.5,
            y : -1,
            z : 0,
        },
        end : {
            x : (-2.5 + 1)/2 + 1.75 * (canvas.width /canvas.height) * 0.5,
            y : 1,
            z : 1,
        },
        superSample : 2, // number of sub pixel samples per pixel if 2 then 2 by 2 is 4 sub samples
        sliceSize : 64, // pixels
        image : cloneCanvas(),
        imageLast : cloneCanvas(),
    }    
    
    //==================================================================================================================
    // worker queue for mandlebrot workers
    //==================================================================================================================
    var mandelbrotQueue = EZWebWorkers.createQueue();

    var numberOfWorkers = 8;  // number of workers.
    var workerIDs = [];  // holds a list of worker ids    
    
    // set up UI
    var numberOFWorkersSlider = document.getElementById("numberOfWorkersElement");   
    numberOFWorkersSlider.value = numberOfWorkers;
    var sliceSizeSlider = document.getElementById("sliceSizeElement");
    sliceSizeSlider.value = view.sliceSize;
    var superSampleSlider = document.getElementById("superSampleElement");
    superSampleSlider.value = view.superSample;
    superSampleSlider.updateAll();
    function getSettingFromUI(){
        var refreshDisplay = false;
        function updateVal(oldV,newV){
            if(oldV !== newV){
                refreshDisplay = true;
            }
            return newV;
        }
        view.superSample = updateVal(view.superSample, Number(superSampleSlider.value));
        view.sliceSize = updateVal(view.sliceSize, Number(sliceSizeSlider.value));
        var numWorkers = Number(numberOFWorkersSlider.value);
        if(numWorkers > numberOfWorkers){
            for(var i = numberOfWorkers; i < numWorkers; i++){
                workerIDs[i] = addWorker();
            }
            refreshDisplay = true;
        }else if(numWorkers < numberOfWorkers){
            for(var i = numWorkers; i < numberOfWorkers; i++){
                popWorker();
            }
            refreshDisplay = true;
        }        
        numberOfWorkers = numWorkers;
        if(refreshDisplay){
            updateStatus();
            updateDisplay = true;
        }
    }
    function updateStatus(){
        renderDetails = "Job pixel size : " + view.sliceSize + " by " + view.sliceSize + " @ "+(view.superSample* view.superSample) + " samples per pixel.";
        
        status.textContent = mandelbrotQueue.workers.length + " workers assigned " + mandelbrotQueue.queue.length + " jobs. " + renderDetails;
    }
        

    
       
    // create copy of canvas helper function
    function cloneCanvas(){
        var c = document.createElement("canvas");
        c.width = canvas.width;
        c.height = canvas.height;
        c.ctx = c.getContext("2d");
        return c;
    }    

    var renderDetails;
    // selection area holds the selected zoom area and zoom animation details
    var rect = {
        transitionTime : 60,
        x : 0,
        y : 0,
        w : 0,
        h : 0,
        start : false,
        animTime : 61,
    };

    //==================================================================================================================
    // Web worker function
    //==================================================================================================================
    const mandelbrotWorker = function(){
        // renders a slice of the mandelbrot described by location.
        function workerFunction(location){
            var px, py, r, g, b, c, x, y, sx ,sy, spx, spy, spz, mx, my, mmx, mmy, itCount, maxIt, tempX, ind, supSamp, scaleX, scaleY, w, h, data,thr1,tempZ;
            const l2 = Math.log(2);
            w = location.width;
            h = location.height;
            scaleX = (location.end.x - location.start.x) / w;
            scaleY = (location.end.y - location.start.y) / h;
            supSamp = location.superSample;
            data = new Uint8ClampedArray(w * h * 4); // pixels data to return
            ind;
            maxIt = 1000;
            for(y = 0; y < h; y += 1){
                for(x = 0; x < w; x += 1){
                    px = x * scaleX + location.start.x;
                    py = y * scaleY + location.start.y;
                    r = g = b = c = 0;
                    for(sy = 0; sy < supSamp; sy += 1){
                        for(sx = 0; sx < supSamp; sx += 1){
                            spx = px + (sx / supSamp) * scaleX;
                            spy = py + (sy / supSamp) * scaleY;
                            itCount = 0;
                            mx = 0;
                            my = 0;
                            while(mx * mx + my * my < (1<<16) && itCount < maxIt){
                                tempX = mx * mx - my * my+ spx;
                                my = 2 *  mx * my + spy;
                                mx = tempX;
                                itCount += 1;
                            }
                            if(itCount !== maxIt ){
                                var log_zn = Math.log( mx*mx + my*my ) / 2
                                var nu = Math.log( log_zn / l2 ) / l2
                                itCount = itCount + 1 - nu
                                itCount /= maxIt;
                                itCount *= Math.PI;
                                r += Math.pow(255-Math.pow(Math.sin(itCount*3 * Math.sign(Math.cos(itCount*20))),2) * 255, 2);
                                g += Math.pow(255-Math.pow(Math.sin(itCount*7 * Math.sign(Math.cos(itCount*30))),3) * 255, 2);
                                b += Math.pow(255-Math.pow(Math.sin(itCount*11 * Math.sign(Math.cos(itCount*70))),2) * 255, 2);
                            }
                            c += 1;
                        }
                    }
                    ind = (x + y * w) * 4;
                    data[ind++] = Math.sqrt(r / c);
                    data[ind++] = Math.sqrt(g / c);
                    data[ind++] = Math.sqrt(b / c);
                    data[ind] = 255;
                }
            }
            location.pixels = data;
            return location;
        }
    }

    //==================================================================================================================
    // worker complete callback. This is called when a worker completes a job
    //==================================================================================================================
    function workerCompleteCallback(location){
        var imgData = view.image.ctx.createImageData(location.width,location.height);
        imgData.data.set(location.pixels);
        view.image.ctx.putImageData(imgData,location.x,location.y);
        regions.add(location.x,location.y,location.width,location.height);
        status.textContent = mandelbrotQueue.workers.length + " workers assigned " + mandelbrotQueue.queue.length + " jobs. " + renderDetails;
        updateDisplay = true;
        
    }


    //==================================================================================================================
    // create the workers
    //==================================================================================================================
    function addWorker(){
        return EZWebWorkers.create(
            mandelbrotWorker,
            {
                jobQueue : mandelbrotQueue,
                completeCallback : workerCompleteCallback
            }
        );
    }
    function popWorker(){
        var wID = workerIDs.pop();
        EZWebWorkers.close(wID);
    }
    function spawnWorkers(){
        EZWebWorkers.shutDown(); //terminate all existing workers an whatever they are doing.
        workerIDs.length = 0;
        for(var i = 0; i < numberOfWorkers; i++){
            workerIDs[i] = addWorker();
        }
    }

    // create a set of jobs to render the mandelbrot
    function createWork(){
        var x,y,w,h,wID,vxStep,vyStep, xSteps, ySteps,xSlice, ySlice;
        wID = workerIDs[0]; // ID of a worker on the queue
        w = view.image.width;
        h = view.image.height;
        xSteps = Math.ceil(w /  view.sliceSize);
        ySteps = Math.ceil(h /  view.sliceSize)
        vxStep = (view.end.x - view.start.x) / (w /  view.sliceSize);
        vyStep = (view.end.y - view.start.y) / (h /  view.sliceSize);
        // cancel any pending jobs
        EZWebWorkers.cancelJobs(wID);
        
        for(y = 0; y < ySteps; y += 1){
            for(x = 0; x < xSteps; x += 1){
                ySlice = xSlice = view.sliceSize
                if(x * view.sliceSize + view.sliceSize >= w){
                    xSlice = w - x * view.sliceSize;
                }
                if(y * view.sliceSize + view.sliceSize >= w){
                    ySlice = h - y * view.sliceSize;
                }
                var res = EZWebWorkers.addJob(wID,{
                    x : x * view.sliceSize,
                    y : y * view.sliceSize,
                    width : xSlice,
                    height : ySlice,
                    start : { x : view.start.x + x * vxStep, y: view.start.y + y * vyStep,z : view.start.z},
                    end : { x : view.start.x + (x + xSlice / view.sliceSize) * vxStep, y: view.start.y + (y + ySlice / view.sliceSize) * vyStep, z : view.start.z},
                    superSample : view.superSample,
                    
                });
            }
        }
        status.textContent = mandelbrotQueue.workers.length + " workers assigned " + mandelbrotQueue.queue.length + " jobs. "+renderDetails ;
    }
    var regions = (function(){
        var items = [];
        var firstFree = -1;
        const MAX_TIME = 8;
        return {
            add(x,y,w,h){
                var it;
                if(firstFree > -1){
                    it = items[firstFree];
                    firstFree = -1;
                    
                }else {
                    for(var i = 0; i < items.length; i++){
                        if(items[i].time === 0){
                            it = items[i];
                            break;
                        }
                    }
                    if(it === undefined){
                        it = items[items.length] = {};
                    }
                }
                it.x = x;
                it.y = y;
                it.w = w;
                it.h = h;
                it.time = MAX_TIME;
            },
            update(ctx){
                var active = false;
                ctx.lineWidth = 1;
                ctx.strokeStyle = "red";
                firstFree = -1;
                for(var i = 0; i < items.length; i ++){
                    var it = items[i];
                    if(it.time > 0){
                        it.time -= 1;
                        ctx.globalAlpha = it.time / MAX_TIME;
                        ctx.strokeRect(it.x + 0.5, it.y + 0.5, it.w-1, it.h-1);
                        active = true;
                    }else if(firstFree === -1){
                        firstFree = i;
                    }
                }
                ctx.globalAlpha = 1;
                return active;
            },
                    
        }
        
    }());


    // Animate and display Mandelbrot
    function update(){
        getSettingFromUI();
        if(!updateDisplay && mouse.buttonRaw === 0){
            requestAnimationFrame(update);
            return;
        }

        updateDisplay = false;        
        // if zooming in draw both the previous image and the next as it is being built
        if(rect.animTime < rect.transitionTime){
            rect.animTime += 1;
            var t = rect.animTime / rect.transitionTime;
            var x =  - (canvas.width / rect.w) * rect.x * t
            var y =  - (canvas.height / rect.h) * rect.y * t
            var w = canvas.width + (canvas.width * (canvas.width / rect.w) - canvas.width) * t;
            var h = canvas.height + (canvas.height * (canvas.height / rect.h) - canvas.height) * t;
            ctx.drawImage(view.imageLast, x, y, w, h);
            x = rect.x * (1-t);
            y = rect.y * (1-t);
            w = rect.w + (canvas.width- rect.w) * t;
            h = rect.h + (canvas.height- rect.h) * t;
            ctx.drawImage(view.image, x, y, w, h);
            updateDisplay = true;
            ctx.setTransform(w / canvas.width, 0, 0, h / canvas.height, x,y);
            if(regions.update(ctx)){
                updateDisplay = true;
            }
            ctx.setTransform(1,0,0,1,0,0);
            
        }else{
            ctx.drawImage(view.image,0,0);
            if(regions.update(ctx)){
                updateDisplay = true;
            }
        }
        // if the mouse button is down select the zoom rectangle    
        if(mouse.buttonRaw === 1){
            if(!rect.start){
                rect.x = mouse.x;
                rect.y = mouse.y;
                rect.start = true;
            }
            rect.w = mouse.x - rect.x;
            rect.h = rect.w * (canvas.height /canvas.width);//mouse.y - rect.y;
            ctx.strokeStyle = "red";
            ctx.lineWidth = 1;
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
            updateDisplay = true;
        }else{
            if(rect.start){  // if the select rectangle has been set set the new view                
                rect.start = false;
                if(rect.w >= 4){ // If select area >= 4 pixels then zoom else just update the display
                    var viewW = (view.end.x - view.start.x);
                    var viewH = (view.end.y - view.start.y);
                    view.start.x = view.start.x + (rect.x / canvas.width) * viewW;
                    view.start.y = view.start.y + (rect.y / canvas.height) * viewH;
                    view.end.x = view.start.x + (rect.w / canvas.width) * viewW;
                    view.end.y = view.start.y + (rect.h / canvas.height) * viewH;
                    rect.animTime = 0;
                    view.imageLast.ctx.drawImage(view.image,0,0);
                    view.image.ctx.clearRect(0,0,view.image.width,view.image.height);
                }else{
                    view.start.z += (view.end.x - view.start.x) /100;
                }
                createWork();  // add the new jobs for the web workers
            }
        }
        if(stop){
            EZWebWorkers.shutDown();
            view = undefined;  // remove images
            console.log("Render stopped.");
            setTimeout(restartCallback,500);
            return;
        }

        requestAnimationFrame(update);
    }
    // Show status
    updateStatus();
    // create the default set of workers
    spawnWorkers();
    // create the first render
    createWork();

    // clear the canvas
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // start animation
    requestAnimationFrame(update);
    
    // set the restart function. This is just to handle the resize as I am to lazy to reset this module
    restartFunction = function(restartCall){
        stop = true;
        restartCallback = restartCall;
        updateDisplay = true;
    }
        
}
exampleStart = mandelbrotExample;