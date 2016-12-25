var restartFunction;
function processExample(){
    imageStatus.textContent = "Loading image!";
    exampleStart = undefined;
    var canvas,ctx;
    
    // Load image and set things up.
    var image = new Image();
    image.src = "owl.jpg";
    image.onload = function(){
        canvas = document.createElement("canvas");
        canvas.className = "imageCanvas";
        canvas.width = this.width;
        canvas.height = this.height;
        ctx = canvas.getContext("2d");
        ctx.drawImage(this,0,0);
        imageContainer.appendChild(canvas);
        imageStatus.textContent = "";
        startProcess.addEventListener("click",processImageStart);
        addOptions();
    }
    // Add filter select options
    function addOptions(){
        for(var i in filters){
            var opt = document.createElement("option");
            opt.value = i;
            opt.innerHTML = i;
            filterType.appendChild(opt);            
        }
    }
    // Creates a blur filter
    function createBlurFilter(size){
        var a = [];
        for(var i = 0; i < size * size; i++){
            a.push(1 / (size * size));
        }
        return a;
    }        
    
    // Convolution filters
    const filters = {
        blur : createBlurFilter(3),
        blurMore : createBlurFilter(5),
        blurLots : createBlurFilter(7),
        sharpen : [0,-1,0,-1,5,-1,0,-1,0],
        sharpenMore : [
            0,0,-1,0,0,
            0,-1,0,-1,0,
            -1,0,9,0,-1,
            0,-1,0,-1,0,
            0,0,-1,0,0],
        edge : [0,1,0,1,-4,1,0,1,0],
        edgeMore : [
            0,0,1,0,0,
            0,1,0,1,0,
            1,0,-8,0,1,
            0,1,0,1,0,
            0,0,1,0,0],
        emboseTopLeft : [ -2,-1,0,-1,1,1,0,1,2],
        emboseTopRight : [ 0,-1,-2,1,1,-1,2,1,0],
        emboseBottomRight : [ 2,1,0,1,1,-1,0,-1,-2],
        emboseBottomLeft : [ 0,1,2,1,1,-1,-2,-1,0],
            
    }
        
    //******************************************************************************************************************
    // Start the image processing
    // When a worker is created it may take a moment of two to create the worker context.
    // Also the data for the image needs to be obtained and passed to the worker. Depending on the device it may take a 
    // second or two.
    // Thus this function first just set the status then calls ProcessImage.
    //******************************************************************************************************************
    
    function processImageStart(){
        startProcess.value = "Creating worker for filter " + filterType.value;
        setTimeout(processImage,0);
    }

    //******************************************************************************************************************
    // Creates a worker and send it a job containing the filter, and pixels.
    // When the worker is done the processed callback puts the pixels onto the image and then closes the worker.
    //******************************************************************************************************************    
    function processImage(){
        // Create a worker from the function imageProcessingWorker
        var workerID = EZWebWorkers.create(imageProcessingWorker);
        // setup the data to send to the worker
        var data = {
            usePhotonCount : true,
            filter : filters[filterType.value],
            mixFilter : null,
            imageData : ctx.getImageData(0,0,canvas.width,canvas.height),
            processRed : true,
            processGreen : true,
            processBlue : true,
            processAlpha : false,
        }
        // Create the job for the new worker
        EZWebWorkers.addJob(
            workerID,  // Id of worker
            data,      // The data to send to the worker
            function(data){   // The complete callback
                ctx.putImageData(data.imageData,0,0);  // put the data onto the image
                EZWebWorkers.close(workerID);          // request the worker close
                startProcess.value = "Job Complete";   
                setTimeout(function(){startProcess.value = "Process!";},1500);
            },
            function(progress){  // Display the progress
                startProcess.value = "Processing "+ progress+"%";
            }
        );
    }
    
    
    //******************************************************************************************************************
    // Worker function
    // workerFunction is created as the worker
    //******************************************************************************************************************    
    const imageProcessingWorker = function(){      
        //******************************************************************************************************************
        // Worker function
        // workerFunction(dataIn) dataIn is the data sent to the worker
        //******************************************************************************************************************      
        function workerFunction(dataIn){  // convolution filter
            var mixFilter,filter, mSide, mHalfSide, imageData, imageDataResult, R, B, G, A, ind, w, h, data, data1, side, halfSide, mix, mixA, a, r, g, b, c, x, y, cy, cx, scx,scy, srcOff, wt, pixelCount, processed;
            dataIn.usePhotonCount = dataIn.usePhotonCount === undefined ? true : dataIn.usePhotonCount;
            if(dataIn.filter !== null){
                filter = dataIn.filter;
                side = Math.round(Math.sqrt(filter.length));
                halfSide = Math.floor(side/2);   
            }
            R = dataIn.processRed === true;
            G = dataIn.processGreen === true;
            B = dataIn.processBlue === true;
            A = dataIn.processAlpha === true;
                
            imageData = dataIn.imageData;
            w = imageData.width;
            h = imageData.height;            
            data1 = new Uint8ClampedArray(w * h * 4);
            data = imageData.data;
            if(dataIn.mixFilter !== null){
                mixFilter = dataIn.mixFilter;
                mSide = Math.round(Math.sqrt(mixFilter.length));
                mHalfSide = Math.floor(mSide/2);   
            }
                
            pixelCount = w * h;
            processed = 0;
            for(y = 0; y < h; y++){
                for(x = 0; x < w; x++){
                    ind = y*4*w+x*4;
                    r = 0;
                    g = 0;
                    b = 0;
                    a = 0;
                    if(filter){
                        for (cy=0; cy<side; cy++) {
                            for (cx=0; cx<side; cx++) {
                                scy = y + cy - halfSide;
                                scx = x + cx - halfSide;
                                if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                                    srcOff = (scy*w+scx)*4;
                                    wt = filter[cy*side+cx];
                                    if(dataIn.usePhotonCount){
                                        r += data[srcOff+0] * data[srcOff+0] * wt;
                                        g += data[srcOff+1] * data[srcOff+1] * wt;
                                        b += data[srcOff+2] * data[srcOff+2] * wt;
                                        a += data[srcOff+3] * data[srcOff+3] * wt;
                                    }else{
                                        r += data[srcOff+0] * wt;
                                        g += data[srcOff+1] * wt;
                                        b += data[srcOff+2] * wt;
                                        a += data[srcOff+3] * wt;
                                    }
                                }
                            }
                        }     
                    }
                    if(mixFilter){
                        mix = 0;
                        for (cy=0; cy<mSide; cy++) {
                            for (cx=0; cx<mSide; cx++) {
                                scy = y + cy - mHalfSide;
                                scx = x + cx - mHalfSide;
                                if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                                    srcOff = (scy*w+scx)*4;
                                    wt = mixFilter[cy*mSide+cx];
                                    if(dataIn.usePhotonCount){
                                        mix += data[srcOff+0] * data[srcOff+0] * wt;
                                        mix += data[srcOff+1] * data[srcOff+1] * wt;
                                        mix += data[srcOff+2] * data[srcOff+2] * wt;
                                    }else{
                                        mix += data[srcOff+0] * wt;
                                        mix += data[srcOff+1] * wt;
                                        mix += data[srcOff+2] * wt;
                                    }
                                }
                            }
                        }     
                        if(dataIn.usePhotonCount){
                            var norm = Math.sqrt(data[ind + 0] * data[ind + 0] + data[ind + 1] * data[ind + 1] + data[ind + 2] * data[ind + 2]) / (255 * 3);
                            mix = 1 - Math.abs(norm - Math.sqrt(Math.max(0,mix)) / (255 * 3));
                            mixA = 1 - mix;
                            if(filter){
                                data1[ind+0] = R ? mix * Math.sqrt(Math.max(0,r)) + mixA * data[ind + 0] : data[ind + 0];
                                data1[ind+1] = G ? mix * Math.sqrt(Math.max(0,g)) + mixA * data[ind + 1] : data[ind + 1];
                                data1[ind+2] = B ? mix * Math.sqrt(Math.max(0,b)) + mixA * data[ind + 2] : data[ind + 2];
                                data1[ind+3] = A ? mix * Math.sqrt(Math.max(0,a)) + mixA * data[ind + 3] : data[ind + 3];
                            }else{
                                data1[ind+0] = R ?  mix * 255 : data[ind + 0]
                                data1[ind+1] = G ?  mix * 255 : data[ind + 1]
                                data1[ind+2] = B ?  mix * 255 : data[ind + 2]
                                data1[ind+3] = A ?  mix * 255 : data[ind + 3]                                
                            }
                        }else{
                            var norm = (data[ind + 0] + data[ind + 1] + data[ind + 2]) / (255 * 3);
                            mix = 1 - Math.abs(norm - Math.max(0,mix) / (255 * 3));
                            mixA = 1 - mix;
                            if(filter){
                                data1[ind+0] = R ? mix * Math.max(0,r) + mixA * data[ind + 0] : data[ind + 0];
                                data1[ind+1] = G ? mix * Math.max(0,g) + mixA * data[ind + 1] : data[ind + 1];
                                data1[ind+2] = B ? mix * Math.max(0,b) + mixA * data[ind + 2] : data[ind + 2];
                                data1[ind+3] = A ? mix * Math.max(0,a) + mixA * data[ind + 3] : data[ind + 3];
                            }else{
                                data1[ind+0] = R ?  mix * 255 : data[ind + 0]
                                data1[ind+1] = G ?  mix * 255 : data[ind + 1]
                                data1[ind+2] = B ?  mix * 255 : data[ind + 2]
                                data1[ind+3] = A ?  mix * 255 : data[ind + 3]
                            }
                        }
                    }else{
                        
                        if(dataIn.usePhotonCount){
                            data1[ind+0] = R ? Math.sqrt(Math.max(0,r)) : data[ind + 0];
                            data1[ind+1] = G ? Math.sqrt(Math.max(0,g)) : data[ind + 1];
                            data1[ind+2] = B ? Math.sqrt(Math.max(0,b)) : data[ind + 2];
                            data1[ind+3] = A ? Math.sqrt(Math.max(0,a)) : data[ind + 3];
                        }else{
                            data1[ind+0] = R ? Math.max(0,r) : data[ind + 0];
                            data1[ind+1] = G ? Math.max(0,g) : data[ind + 1];
                            data1[ind+2] = B ? Math.max(0,b) : data[ind + 2];
                            data1[ind+3] = A ? Math.max(0,a) : data[ind + 3];
                        }
                    }
                    //==================================================================================================
                    // Send a progress message ever 64k pixels processed
                    //==================================================================================================                    
                    processed += 1;
                    if(processed % (1024 * 64) === 0){
                        progressMessage(Math.floor((processed / pixelCount) * 100));
                    }
                }
            }
            //==================================================================================================
            // Set the image data to the new pixel values            
            imageData.data.set(data1);
            //==================================================================================================
            // Return the data back to the main page.
            return dataIn;
        }
    }
    
    
    
        
}
exampleStart = processExample;