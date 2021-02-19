const { app, BrowserWindow,ipcMain } = require('electron')
var net = require('net');

var client = new net.Socket();

client.setEncoding('utf8');  

var win;
var dataInterval;

var up=true
var down=true

var oldDown = 0
var oldUp = 0

var timeInterval = 4;
var firstReadingDown=true 
var firstReadingUp=true 

var etherPortNum=1

//get wlan basic laninst 1 wlaninst 1

function createWindow () {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  clearInterval(dataInterval)
  if(!client.destroyed){
    client.destroy();
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

 // ... do actions on behalf of the Renderer
ipcMain.handle('connect', (event, ...args) => {
 //connect to client
  client.connect(23, '192.168.100.1', ()=> {
    client.write('root\r\n');
    setTimeout(() => {
        client.setTimeout(0);
        client.write('admin\r\n');
        
        //ocitaj samo jednom status tokom konektovanja
        client.once("data",(data)=>{
          
          var data=data.toString()

          var status=checkConnectStatus(data)
        
          win.webContents.send('connect-result', status)
        })    
    }, 2000)
  });

//ovo je bitno ako je pogrsna ip adrsesa
  if(client.connecting){
    console.log(client.connecting)
    win.webContents.send('connect-result', "Conecting....")
    //setuj time out na 9 sekundi =>ovo  ce nas odvesti nakon 9s na ontimeuout listener
    client.setTimeout(9000);
  }
})
 
// ... do actions on behalf of the Renderer
ipcMain.handle('disconnect', (event, ...args) => {
  win.webContents.send('connect-result','Connection closed')

   clearInterval(dataInterval)
   if(!client.destroyed){
    client.destroy();
  }
})

// ... do actions on behalf of the Renderer
ipcMain.handle('startGraf', (event, arg1,arg2) => { 
   
   etherPortNum=arg1

   switch(Number(arg2)) {
    case 2:
      up=false
      down=true
      break;
    case 3:
      up=true
      down=false
      break;
    default:
      up=down=true
  }
  console.log("up", up)
  console.log("down", down)

   firstReadingDown=true 
   firstReadingUp=true 
   clearInterval(dataInterval)

   dataInterval=setInterval(()=> {
     client.write(`display portstatistics portnum ${etherPortNum}\r\n`);  
  }, timeInterval*1000);
})

//Drugi mozda nacina hendlovanja firstreading je
//mozda koristenje clent.emmit("prvikurec") event-a
//a zatim hvatanja eventa sa client.on('prvikurec',()=>{})


var transWifi= down && data.toString().match(/(?<=TotalBytesSent \s\s+:\s)\d+/g)
var receiWifi =up && data.toString().match(/(?<=TotalBytesReceived \s\s+:\s)\d+/g)

client.on('data', function (data) {  
  //https://javascript.info/regexp-lookahead-lookbehind                 
  //var trans = data.toString().match(/tx_byte_ok \s\s+:\s(\d+)/g)
  var transm = down && data.toString().match(/(?<=tx_byte_ok \s\s+:\s)\d+/g)
  console.log("transm", transm)
  if (transm) {
      //newDown= Number(String(trans).match(/(\d+)/g))
      //[ '881213013905' ] Izvadi string i pretvoru u number
      var newDown=Number(transm[0]) 
      
      var resultDown=calculateBitRateDown(newDown)
      
      firstReadingDown=false
      
      win.webContents.send('resultValDown', resultDown)
  }

  var receiv =up && data.toString().match(/(?<=rx_byte_ok \s\s+:\s)\d+/g)
  console.log("receiv", receiv)
  if (receiv) {
 
      var newUp=Number(receiv[0]) 
      
      var resultUp=calculateBitRateUp(newUp)

      firstReadingUp=false

      win.webContents.send('resultValUp',  resultUp)  
  }
});

//cliesnt timeout
client.on('timeout', () => {
  console.log('socket timeout');
  win.webContents.send('connect-result', "TIME OUT.")
  console.log(client.timeout)
  client.destroy();
});


//clien destroyed
client.on('close', function() {
  console.log('Connection closed');
});

function checkConnectStatus(data){
  if(data.match(/WAP>/g)){
   return "CONNECTED";
  }else if(data.match(/User name or password is wrong/g)){
    return "User name or password is wrong.";
  }else{
    return data;
  }
}

function calculateBitRateDown(newBajt){  
      if(firstReadingDown){
        oldDown=newBajt
        result=0
      }else{
        result= (newBajt- oldDown)/timeInterval;//BAJTA/s
        oldDown= newBajt
        result = result * 8         //bits/s
        result = result / 1000      //kbits/s
      }
      return result
}
function calculateBitRateUp(newBajt){  
      if(firstReadingUp){
        oldUp=newBajt
        result=0
      }else{
        result= (newBajt- oldUp)/timeInterval;//BAJTA/s
        oldUp= newBajt
        result = result * 8         //bits/s
        result = result / 1000      //kbits/s
      }
      return result
}