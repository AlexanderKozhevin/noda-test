
const Noda = {};

window.noda = Noda;

Noda.MessageProcessingQueue = {};

Noda.isInstalled = function() {
    console.log("is installed " + typeof window.vuplex);
    return typeof window.vuplex !== 'undefined';
}

Noda.createNode = async function(props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('createNode', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.createNode failed: " + error);
        });
    });
}

Noda.updateNode = async function(props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('updateNode', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.updateNode failed: " + error);
        });
    });
}

Noda.deleteNode = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('deleteNode', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.deleteNode failed: " + error);
        });
    });
}

Noda.listNodes = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('listNodes', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.listNodes failed: " + error);
        });
    });
}

Noda.createLink = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('createLink', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.createLink failed: " + error);
        });
    });
}

Noda.updateLink = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('updateLink', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.updateLink failed: " + error);
        });
    });
}

Noda.deleteLink = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('deleteLink', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.deleteLink failed: " + error);
        });
    });
}

Noda.listLinks = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('listLinks', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.listLinks failed: " + error);
        });
    });
}

Noda.getUser = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('getUser', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.getUser failed: " + error);
        });
    });
}

Noda.loadJson = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('loadJson', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.loadJson failed: " + error);
        });
    });
}

Noda.saveJson = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('saveJson', messageId, props);

        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.saveJson failed: " + error);
        });
    });
}

Noda.clearMap = async function (props) {
    return new Promise(function (resolve, reject) {
        var messageId = uuidv4();
        var requestPromise = window.noda.sendMessage('clearMap', messageId, props);
        
        requestPromise.then(response => {
            resolve(response);
        }).catch(error => {
            reject("Call to Noda.clearMap failed: " + error);
        });
    });
}

Noda.sendMessage = async function(messageType, messageId, messageData) {
  return new Promise(function (resolve, reject) {

    // ❗ НЕ генерим новый messageId — используем тот, что пришёл
    // var messageId = uuidv4();  // <-- УДАЛИТЬ

    const timeoutMs = 15000;
    const timer = setTimeout(() => {
      if (window.noda.MessageProcessingQueue[messageId]) {
        window.noda.MessageProcessingQueue[messageId] = null;
        reject(`Timeout waiting response for ${messageType} (${messageId})`);
      }
    }, timeoutMs);

    window.noda.MessageProcessingQueue[messageId] = function (response) {
      clearTimeout(timer);
      window.noda.MessageProcessingQueue[messageId] = null;

      if (response.messageStatus == "Success") {
        if (response.messageData != null) resolve(response.messageData);
        else resolve(response.messageStatus);
      } else {
        reject(response.messageStatus);
      }
    }

    try {
      console.log("Sending:", { messageType, messageId, messageData });
      window.vuplex.postMessage({ messageType, messageId, messageData });
    } catch(ex) {
      clearTimeout(timer);
      reject("Could not send message: " + ex);
    }
  });
}

if (window.vuplex) {
    addMessageListener();
} else {
    window.addEventListener('vuplexready', addMessageListener);
}

function addMessageListener() {

    window.vuplex.addEventListener('message', function (event) {
        let json = event.data;

        console.log("Receiving Response: " + event.data);

        var response = JSON.parse(event.data);

        if (response.messageId != null) {
            
            var messageProcessingCallback = window.noda.MessageProcessingQueue[response.messageId];

            if (messageProcessingCallback != null) {
                messageProcessingCallback(response);
            }
        }
        
        if (response.eventType != null)
        {
            const eventHandler = "on" + response.eventType.charAt(0).toUpperCase() + response.eventType.slice(1)
            if(window.noda[eventHandler] != null)
            {
                if (response.eventData != null)
                    window.noda[eventHandler](response.eventData);
                else
                    window.noda[eventHandler]();
            }
        }
    });

    if(window.noda['onInitialized'] != null)
        window.noda['onInitialized']();

}

function uuidv4()
{
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function sleep(ms)
{
    return new Promise(resolve => setTimeout(resolve, ms));
}
