const { ipcRenderer, desktopCapturer, remote } = require('electron')
const { dialog } = remote;
const { writeFile } = require('fs');
const customTitlebar = require('custom-electron-titlebar');

var titleBar=new customTitlebar.Titlebar({
    backgroundColor: customTitlebar.Color.fromHex('#e46425'),
    overflow:'hidden'
});

//browser build in mediarecorder, to record 
// MediaRecorder instance to capture footage
let mediaRecorder; 
let recordedChunks=[];
let stream;
let inputSources=[]
let buffer=[]



var choosenPort =5;
var down=true;
var up=true;
var grafStarted=false;
var connectionOpen=false;
var maxDown=0;
var maxUp=0;


// Find the element
var canvas = document.getElementById("mycanvas");

var ctnBtn=document.getElementById('cntBtn')
var dctnBtn=document.getElementById('discntBtn')

var textarea= document.getElementById("ta")

var start = document.getElementById("start")
var stop = document.getElementById("stop")
var startRec = document.getElementById("startRec")
var stopRec = document.getElementById("stopRec")

var downBtn = document.getElementById("down")
var upBtn = document.getElementById("up")

var myDialog = document.getElementById("dialog")
var ssid = document.getElementById("ssid")

var downMaxHTML=document.getElementById("downMax")
var upMaxHTML = document.getElementById("upMax")

const videoElement = document.querySelector('video');

// Create a time series
var series1 = new TimeSeries();
var series2 = new TimeSeries();

// Create the chart
var chart = new SmoothieChart({ 
    labels: { fontSize: 15 },
    tooltip: true, 
    minValue: 0, 
    timestampFormatter: SmoothieChart.timeFormatter,
    maxValueScale: 1.2 
});

chart.addTimeSeries(series1, { lineWidth: 3, strokeStyle: '#00ff00', fillStyle: 'rgba(0, 255, 0, 0.4)' });
chart.addTimeSeries(series2, { lineWidth: 3, strokeStyle: 'rgb(255, 0, 255)', fillStyle: 'rgba(255, 0, 255, 0.3)' });

chart.streamTo(canvas, 500);

//chart.start();
//chart.stop();



function getPortid(number){
    
    if(!grafStarted){
        //ako je graf nije startovan
        //remove active sa starog elementa
        document.getElementById(choosenPort).classList.remove("active")

        choosenPort = number;

        //add active na novi element
        document.getElementById(number).classList.add("active")
    }

}

function setDownUp(direction){
    if(!grafStarted){
        if(direction=="down"){
            down = !down
            downBtn.classList.toggle("active2")
            
        }else{
            up=!up
            upBtn.classList.toggle("active2")
        } 
    }
}

//posalji signal mainu za connect to host
function connect(){ 
    ipcRenderer.invoke('connect')    
}

//posalji signal mainu za diskonect from host
function disConnect() {
    connectionOpen = false
    stopGraf()
    ipcRenderer.invoke('disconnect') 
}

//posalji signal mainu da zapocne intervanu petlju ocitanja
//vrijednosti 
function startGraf(){
    if(connectionOpen){
        start.classList.add("active") 
        stop.classList.remove("active") 
        grafStarted=true
        ipcRenderer.invoke('startGraf', choosenPort, down,up) 
        showDialog("Graf Started.")
    } else {
        //elese pokazi dijalog
        showDialog("Sorry. Connection is closed.")
        
    }
}

function showDialog(text){
        myDialog.firstElementChild.innerHTML=text
        myDialog.style.transform = "translateX(1rem)"
        setTimeout(()=>{
            myDialog.style.transform= "translateX(-12rem)"
        }, 3000)
}

function stopGraf() {
    
    if(grafStarted){
        stop.classList.add("active")
        start.classList.remove("active")
        maxDown = 0;
        maxUp = 0

        ssid.style.transform = "translateY(-50px)"

        grafStarted = false

        ipcRenderer.invoke('stopGraf') 
        showDialog("Graf Stoped.")
    }
    
}

getVideoSource()

function startReco(){

    mediaRecorder.start();
    startRec.style.display='none'
    stopRec.style.display='flex'
}

function stopReco() {
    
    mediaRecorder.stop();

    inputSources = []
    recordedChunks=[]
    buffer=[]

    startRec.style.display = 'flex'
    stopRec.style.display = 'none'                
}


async function getVideoSource(){
    inputSources = await desktopCapturer.getSources({
        types: ['window', 'screen']
    });
    inputSources.map(source => {
        if(source.name ==="RGW Traffic Monitoring"){
            selectSource(source)
        }
    })
    
    
}
// Change the videoSource window to record
async function selectSource(source){
    const constraints = {
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id
            }
        }
    };
    // Create a Stream
    stream = await navigator.mediaDevices
        .getUserMedia(constraints);

        // Create the Media Recorder
    const options = { mimeType: 'video/webm; codecs=vp9' };
    mediaRecorder = new MediaRecorder(stream, options);

    // Register Event Handlers
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;
}
    


function handleDataAvailable(e){
    console.log('video data available');
    recordedChunks.push(e.data);      
}

async function handleStop(){
    const blob = new Blob(recordedChunks, {
        type: 'video/webm; codecs=vp9'
    });

    buffer = Buffer.from(await blob.arrayBuffer());
    
    const { filePath } = await dialog.showSaveDialog({
        buttonLabel: 'Save video',
        defaultPath: `vid-${Date.now()}.webm`
    });

    if (filePath) {
        writeFile(filePath, buffer, () => console.log('video saved successfully!'));
    }
}





//status dobijen od mejna tokom i konektovanja
ipcRenderer.on('connect-result', function (event, arg) {

    if (arg.toString() == "Connection open.") {
        connectionOpen=true
        ctnBtn.style.display = 'none'
        dctnBtn.style.display = "block"
        textarea.style.color = "lightgreen"

    } else if (arg.toString() == "Connection closed." || arg.toString() == "Conecting....") {
        ctnBtn.style.display = 'block'
        dctnBtn.style.display = "none"
        textarea.style.color = "lightblue"
    } else {
        //ENYTHING ELSE including ERROR OCURED
        ctnBtn.style.display = 'none'
        dctnBtn.style.display = "block"
        textarea.style.color = "rgb(245, 87, 111)"
    }

    textarea.innerHTML = arg;

})

//rezultati dobijeni od maina unutar koje imaintervalna petlja
ipcRenderer.on('resultValDown', function (event, arg) {              
    var resultDown = Number(arg);
    series1.append(Date.now(), resultDown);
    if(resultDown > maxDown){
        maxDown=resultDown
    }
    downMaxHTML.innerHTML = maxDown.toFixed(2)
})

//rezultati dobijeni od maina unutar koje imaintervalna petlja
ipcRenderer.on('resultValUp', function (event, arg) {
    var resultUp = Number(arg);
    series2.append(Date.now(), resultUp);
    if (resultUp > maxUp) {
        maxUp = resultUp
    }
    upMaxHTML.innerHTML = maxUp.toFixed(2)
})

//za dobijanje ssid name ali samo jednom tokomp prvog
ipcRenderer.on('ssid', function (event, arg) {
    console.log(arg)
    ssid.innerHTML="SSID: " + arg
    ssid.style.transform="translateY(0px)"
})
