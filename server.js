'use strict';

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const os = require('os');
const config = require('./config/config');
const bodyParser = require('body-parser');
const compression = require('compression');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const cors = require("cors");
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const mail = require('./utils/mail');

mongoose.Promise = global.Promise;
mongoose.connect(config.MONGO_URI);

app.set('case sensitive routing', true);
app.set('env', config.NODE_ENV);
app.set('port', config.PORT);

const swaggerDocument = YAML.load('./api/swagger/swagger.yaml');
if (app.get('env') === 'production') {
	swaggerDocument.host = config.SWAGGER_URL;
}
else {
	swaggerDocument.host = `${os.hostname()}:${config.PORT}`;
}

let swagOptions = {
	explorer: false,
	customCss: '.swagger-ui .topbar { display: none }'
};
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swagOptions));

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));

// importing all modules
app.use('/api',
  require('./modules/user/router')
);

app.use(function(req, res) {
  return res.status(404).send({ success: false, msg: 'API not found', data: req.originalUrl + ' not found' })
});

// this route is only for upload file testing using html code use uploadImage api to upload file
app.get('/upload', function (req, res) {
  res.sendFile(__dirname + '/partials/index.html');
});

var sendEmail = function (counter) {

  let mailOptions = {
    from: `Node API 😡<contactjittu@gmail.com>`,
    to: `contactjittu@gmail.com`,
    subject: `API Crashed ✖`,
    html: `<pre><b>Hello Jitendra,
      API is crashing ${counter} times?</b></pre>`
  };
  mail.sendEmail(mailOptions);
}

if (config.CLUSTERING) {

  const cluster = require('cluster');

  if (cluster.isMaster) {
    let crashCount = 0;
    const cpus = os.cpus().length;
    console.log(`Forking for ${cpus} CPUs`);
    for (let i = 0; i < cpus; i++) {
      cluster.fork();
    }

    cluster.on('exit', function (worker, code, signal) {
      if (code !== 0 && !worker.exitedAfterDisconnect) {
        console.log(`Worker ${worker.id} crashed. ` + 'Starting a new worker...');
        crashCount++;
        cluster.fork();

        if (crashCount === 5) {
          console.log('Crashed 5 times, I am sending an email');
          sendEmail(crashCount);
        }
      }
    });

  } else {
    startServer();
  }

} else {
  startServer();
}

function startServer() {
  app.listen(app.get('port'), function () {
    console.log(`Server is listening on http://${os.hostname()}:${app.get('port')}`);
  });
}

app.use(function (err, req, res, next) {
  return res.status(500).send({ success: false, msg: 'Internal Server Error', data: (app.get('env') === 'production') ? {} : err.stack });
});

module.exports = app;