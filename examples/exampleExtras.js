var canvas,ctx,mouse;
var exampleStart;
function setupCanvas(){
    canvas = document.getElementById("displayCanvas");
    if(canvas !== null){
        canvas.width = Math.floor(innerWidth * 0.8);
        canvas.height = Math.floor(innerHeight * 0.6);;
        ctx = canvas.getContext("2d");
        if(mouse === undefined){
            setupMouse(canvas);
        }
        if(restartFunction !== undefined){
            restartFunction(exampleStart);
        }
    }
}
var debouncer = {};
function debounce(name,call){
    if(debouncer[name] === undefined){
        debouncer[name] = {};
    }else{
        clearTimeout(debouncer[name].timeoutHandle);
    }
    debouncer[name].timeoutHandle = setTimeout(call,500);
}

function setupMouse(element){
    mouse = {
        bm : [1, 2, 4, 6, 5, 3],
        buttonRaw : 0,
        x: 0,y:0,
        target : null,
        addElement : function(element){
            if(element !== null){
                element.addEventListener("mousemove",mouseEvent);
                element.addEventListener("mousedown",mouseEvent);
                element.addEventListener("mouseup",mouseEvent);
            }
        }
            
    };
    var m = mouse;
    function mouseEvent(e){
        m.target = e.currentTarget;
        m.bounds = e.currentTarget.getBoundingClientRect();
        var t = e.type;
        m.x = e.pageX - (m.bounds.left + scrollX);
        m.y = e.pageY - (m.bounds.top + scrollY);     
        if (t === "mousedown") {
            m.buttonRaw |= m.bm[e.which - 1];
        } else if (t === "mouseup") {
            m.buttonRaw &= m.bm[e.which + 2];
        }

        //e.preventDefault();    
    }                
    element.addEventListener("mousemove",mouseEvent);
    element.addEventListener("mousedown",mouseEvent);
    element.addEventListener("mouseup",mouseEvent);
}


function createPrivateMouse(element,mouse){
    if(mouse === undefined){
        mouse = {
            bm : [1, 2, 4, 6, 5, 3],
            buttonRaw : 0,
            x: 0,y:0, w:0,
            callback : null,
            target : null,
        }
    }
    var m = mouse;
    function mouseEvent(e){
        m.target = e.currentTarget;
        m.bounds = e.currentTarget.getBoundingClientRect();
        var t = e.type;
        m.x = e.pageX - (m.bounds.left + scrollX);
        m.y = e.pageY - (m.bounds.top + scrollY);     
        if (t === "mousedown") {
            m.buttonRaw |= m.bm[e.which - 1];
        } else if (t === "mouseup") {
            m.buttonRaw &= m.bm[e.which + 2];
        }
        if(m.callback !== undefined){
            m.callback(m);
        }
        
        //e.preventDefault();    
    }                
    element.addEventListener("mousemove",mouseEvent);
    element.addEventListener("mousedown",mouseEvent);
    element.addEventListener("mouseup",mouseEvent);
    return mouse;
}

window.addEventListener("load",function(){
    function mouseCallback(mouse){
        if(mouse.buttonRaw){
            var t = mouse.target
            var v = mouse.x / t.ctx.canvas.width;
            v *= (t.max - t.min);
            v = t.min + Math.round(v / t.step) * t.step;
            mouse.target.value = v;
            render(mouse.target);
        }
    }
    function render(element){
        //element.ctx.fillStyle = element.style.backgroundColor;
        var ctx = element.ctx;
        var can = ctx.canvas;
        ctx.clearRect(0,0,can.width,can.height);
        ctx.fillStyle = "red";
        var v = ((element.value - element.min) / (element.max - element.min)) * can.width;
        ctx.fillRect(0,0,v,element.ctx.canvas.height);
        if(element.numElement !== undefined){
            element.numElement.textContent = element.value;
        }
    }
    function updateAll(){
        sliders.forEach(render);
    }
    var mouse;
    var sliders = [...document.querySelectorAll(".gSlider")];
    sliders.forEach(el => {
        var vals = el.dataset.sliderVals.split(",");
        el.min = Number(vals[0]);
        el.max = Number(vals[1]);
        el.step = Number(vals[2]);
        el.value = Number(el.dataset.value);
        var input = document.createElement("span");
        input.className = "sliderText";
        input.textContent = el.value;
        
        var can = document.createElement("canvas");
        can.width = el.dataset.size
        can.height = 14;
        can.className = "sliderCanvas";

        el.ctx = can.getContext("2d");
        el.mouse = createPrivateMouse(el);
        if(el.mouse.callback === null){
            el.mouse.callback = mouseCallback;
        }
        el.appendChild(can);
        el.appendChild(input);
        el.numElement = input;
        el.updateAll = updateAll;
        render(el);
    })

    
});

window.addEventListener("resize", setupCanvas);
window.addEventListener("load",function(){
    setupCanvas();
    exampleStart();
    
});


