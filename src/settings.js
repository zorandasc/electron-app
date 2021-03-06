const { ipcRenderer } = require("electron");
const settings = require("electron-settings");
const envVariables = require("../env-variables.json");

var key = envVariables.mySecretKey;
var encryptor = require("simple-encryptor")(key);

//gdije se cuvajua seting podaci na korisnikoj opremi
//console.log('File used for Persisting Data - ' +
//     settings.file());

//za dobijenja settings podataka nakon
//pojavljivanja setting windowa
settings.get("key").then((data) => {
  ip.value = data.strIp;
  protocol.value = data.strProtocol;
  username.value = encryptor.decrypt(data.strUsername);
  password.value = encryptor.decrypt(data.strPassword);
});

//dohvat html lemente
const form = document.getElementById("form");
const ip = document.getElementById("ip");
const username = document.getElementById("username");
const password = document.getElementById("password");
const protocol = document.getElementById("protocol");
var dialog = document.getElementById("dialog");
var dialogBtn = document.getElementById("dialogBtn");

form.addEventListener("submit", submitFunction);

//after clicking save butoon
function submitFunction(e) {
  //stop default submit to file
  e.preventDefault();

  //validate ip address
  //ako postoji string i ako nije validan return
  //from submit
  if (ip.value && !validateIPaddress(ip.value)) {
    return;
  }

  //ako je passwor epmty field, do nothing
  //a ako postoji encrytpuj
  password.value = password.value
    ? encryptor.encrypt(password.value)
    : password.value;

  //the same for username
  username.value = username.value
    ? encryptor.encrypt(username.value)
    : username.value;

  //izabran je setSYnc tako da se prvo to
  //izvrsi prije dole closing windowa
  settings.setSync("key", {
    strIp: ip.value,
    strProtocol: protocol.value,
    strUsername: username.value,
    strPassword: password.value,
  });

  //send message to main.js to close this window
  ipcRenderer.invoke("settings");
}

//clear button ne zatvara settings window, wec mora save
function clearFields() {
  closeDialog();
  form.reset();
}

function validateIPaddress(ipaddress) {
  if (
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
      ipaddress
    )
  ) {
    return true;
  }
  //ako je false pokazi dialog
  dialog.style.transform = "translateX(5px)";
  return false;
}

//zatvori diajlog
function closeDialog() {
  dialog.style.transform = "translateX(-100%)";
}
