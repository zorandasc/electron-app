const { app, BrowserWindow,ipcMain } = require('electron')
var net = require('net');

var client = new net.Socket();

client.setEncoding('utf8');  

var win;
var dataInterval;
var oldDown = 0
var newDown = 0;
var result = 0;
var timeInterval = 4000;

function createWindow () {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
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
          console.log(data)
          var data=data.toString()
          if(data.match(/WAP>/g)){
            win.webContents.send('connect-result', "CONNECTED")
          }else if(data.match(/User name or password is wrong/g)){
            win.webContents.send('connect-result', "User name or password is wrong.")
          }else{
            win.webContents.send('connect-result', data)
          }
      
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
ipcMain.handle('startGraf', (event, ...args) => { 
   dataInterval=setInterval(function () {
      client.write('display portstatistics portnum 3\r\n');    
  }, timeInterval);
})




client.on('data', function (data) {                   
  var trans = data.toString().match(/tx_byte_ok \s\s+:\s(\d+)/g)
  if (trans) {
      newDown= Number(String(trans).match(/(\d+)/g))//Mbit

      result= (newDown- oldDown)/4;//BAJTA/s
      result = result * 8         //bits/s
      result = result / 1000      //kbits/s

      oldDown= newDown

      console.log("RESULTs kbit/s", result);
      win.webContents.send('resultVal', result)
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