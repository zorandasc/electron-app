const { app, BrowserWindow, ipcMain } = require("electron");
var net = require("net");

var client = new net.Socket();

client.setEncoding("utf8");

var win;
var dataInterval;

var ipAdress = "192.168.100.1";
var port = "23";
var username = "root";
var password = "admin";

var isConnected=false

var downDirection = true
var upDirection = true

var oldBajtDown = 0;
var oldBajtUp = 0;
var newBajtDown;
var newBajtUp;

var resultBRDown;
var resultBRUp;

var transmitString;
var receiveString;

var timeInterval = 4;

var firstReadingDown = true;
var firstReadingUp = true;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
    },
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  clearInterval(dataInterval);
  if (!client.destroyed) {
    client.destroy();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ... do actions on behalf of the Renderer
ipcMain.handle("connect", (event, ...args) => {
  //connect to client
  client.connect(port, ipAdress,() => {
    client.write(`${username}\r\n`);
    setTimeout(() => {
      client.write(`${password}\r\n`);
      client.setTimeout(0);
    }, 2000)   
  });

  //ovo je bitno ako je npr. pogrsna ip adrsesa
  if (client.connecting) {
    win.webContents.send("connect-result", "Conecting....");
    //setuj time out na 9 sekundi =>ovo  ce nas odvesti nakon 9s na ontimeuout listener
    client.setTimeout(9000);
  }
});

// ... do actions on behalf of the Renderer
ipcMain.handle("disconnect", (event, ...args) => {
  win.webContents.send("connect-result", "Connection closed.");
  //console.log(...args);
  isConnected=false
  firstReadingDown = true;
  firstReadingUp = true;
  clearInterval(dataInterval);
  if (!client.destroyed) {
    client.destroy();
  }
});

// ... do actions on behalf of the Renderer
ipcMain.handle("startGraf", (event, portNum, down,up) => {
  //set direction true or flase
  downDirection = down;
  upDirection = up;

  firstReadingDown = true;
  firstReadingUp = true;

  console.log("STARTED.",downDirection, upDirection, portNum)
  //start new interval reading with choosen portnum
  intervalPortStatistics(Number(portNum));
});

ipcMain.handle("stopGraf", () => {
    //if firstreading true result=0
  firstReadingDown = true;
  firstReadingUp = true;

  //clear old loop interval
  clearInterval(dataInterval);
  console.log("STOPED")
})



client.on('error',(arg)=>{
    console.log("ERORRONJA",arg)
    client.destroy()
})



//na svaki interval ocitaj podatke
client.on("data", function (data) {
  //on connecting, if isConnected true skip this if
  
  if(!isConnected){
    var data = data.toString();
    isConnected = checkConnectStatus(data);
  }
  //EVERY timeInterval CALCULATE DOWNSTREAM if downDirection false do nothing
  var transm = downDirection && data.toString().match(transmitString);
  //result:  transm= null, null, [ '881213013905' ], null, null
  if (transm) {
    //[ '881213013905' ] Izvadi string i pretvoru u number
    newBajtDown = Number(transm[0]);
    
    resultBRDown = firstReadingDown
      ? 0
      : calculateBitRate(newBajtDown, oldBajtDown);

    oldBajtDown = newBajtDown;

    firstReadingDown = false;

    win.webContents.send("resultValDown", resultBRDown);
  }

  //EVERY timeInterval CALCULATE UPSTREAM, if upDirection flase do notihing
  var receiv = upDirection && data.toString().match(receiveString);

  if (receiv) {
    newBajtUp = Number(receiv[0]);

    resultBRUp = firstReadingUp ? 0 : calculateBitRate(newBajtUp, oldBajtUp);

    oldBajtUp = newBajtUp;

    firstReadingUp = false;

    win.webContents.send("resultValUp", resultBRUp);
  }
});

//cliesnt timeout
client.on("timeout", () => {
  console.log("socket timeout");
  win.webContents.send("connect-result", "Time out. Check host IP address.");
  client.destroy();
});

//clien destroyed
client.on("close", function () {
  console.log("Connection closed");
});

function checkConnectStatus(data) {
  var status="";
  var connected=false
  if (data.match(/WAP>/g)) {
    connected=true
    status= "Connection open.";
  } else if (data.match(/User name or password is wrong/g)) {
    status= "Username or password is wrong.";
  } else {
    status= data.trim();
  }
  win.webContents.send("connect-result", status);
  return connected
}

function intervalPortStatistics(portNum) {
  //novi nacin ekstraktovanja :
  //https://javascript.info/regexp-lookahead-lookbehind <=operater
  if (portNum == 5) {
    //for wifi
    transmitString = /(?<=TotalBytesSent \s\s+:\s)\d+/g;
    receiveString = /(?<=TotalBytesReceived \s\s+:\s)\d+/g;
    dataInterval = setInterval(() => {
      client.write(`get wlan basic laninst 1 wlaninst 1\r\n`);
    }, timeInterval * 1000);
  } else {
    //for ethernet
    transmitString = /(?<=tx_byte_ok \s\s+:\s)\d+/g;
    receiveString = /(?<=rx_byte_ok \s\s+:\s)\d+/g;
    dataInterval = setInterval(() => {
      client.write(`display portstatistics portnum ${portNum}\r\n`);
    }, timeInterval * 1000);
  }
}

function calculateBitRate(newBajt, oldBajt) {
  result = (newBajt - oldBajt) / timeInterval; //BAJTA/s
  result = result * 8; //bits/s
  result = result / 1000; //kbits/s
  return result;
}
