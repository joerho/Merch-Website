var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var Session = require('./Routes/Session.js');
var Validator = require('./Routes/Validator.js');
var CnnPool = require('./Routes/CnnPool.js');
var async = require('async');
var app = express();
var argv = process.argv.slice(2);

//app.use(function(req, res, next) {console.log("Hello"); next();});
// Static paths to be served like index.html and all client side js
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
   console.log("Handling " + req.path + '/' + req.method);
   res.header("Access-Control-Allow-Origin", "http://localhost:3000");
   res.header("Access-Control-Allow-Credentials", true);
   res.header("Access-Control-Allow-Methods", "POST, DELETE, OPTIONS, PUT, GET");
   res.header("Access-Control-Allow-Headers", "content-type, Location");
   res.header("Access-Control-Expose-Headers", "content-type, Location");
  next();
});

// No further processing needed for options calls.
app.options("/*", function(req, res) {
   res.status(200).end();
});

// Static path to index.html and all clientside js
// Parse all request bodies using JSON
app.use(bodyParser.json());

// Attach cookies to req as req.cookies.<cookieName>
app.use(cookieParser());

// Set up Session on req if available
app.use(Session.router);

// Check general login.  If OK, add Validator to |req| and continue processing,
// otherwise respond immediately with 401 and noLogin error tag.
app.use(function(req, res, next) {
   console.log(req.path);
   if (req.session || (req.method === 'POST' &&
    (req.path === '/Prss' || req.path === '/Ssns'))) {
      req.validator = new Validator(req, res);
      next();
   }
   else
      res.status(401).end();
});

// Add DB connection, with smart chkQry method, to |req|
app.use(CnnPool.router);

// Load all subroutes
app.use('/Prss', require('./Routes/Account/Prss.js'));
app.use('/Ssns', require('./Routes/Account/Ssns.js'));
// app.use('/Cnvs', require('./Routes/Conversation/Cnvs.js'));
// app.use('/Msgs', require('./Routes/Conversation/Msgs.js'));

// Special debugging route for /DB DELETE.  Clears all table contents,
//resets all auto_increment keys to start at 1, and reinserts one admin user.
app.delete('/DB', function(req, res) {
   if (req.session.isAdmin()) {
       var cbs = ["Conversation", "Message", "Person"].map(function(tblName) {
          return function(cb) {
             req.cnn.query("delete from " + tblName, cb);
          };
       });

       cbs = cbs.concat(["Conversation", "Message", "Person"]
        .map(function(tblName) {
          return function(cb) {
             req.cnn.query("alter table " + tblName +
              " auto_increment = 1", cb);
          };
       }));

       cbs.push(function(cb) {
          req.cnn.query('INSERT INTO Person (firstName, lastName, email,' +
           ' password, whenRegistered, role) VALUES ' +
           '("Joe", "Admin", "adm@11.com","password", NOW(), 1);', cb);
       });

       cbs.push(function(callback){
          for (var session in Session.sessions)
             delete Session.sessions[session];
          callback();
       });

       async.series(cbs, function(err) {
          req.cnn.release();
          if (err)
             res.status(400).json(err);
          else
             res.status(200).end();
       });
   }
   else {
       req.cnn.release();
       res.status(403).end();
   }
});

// Handler of last resort.  Print a stacktrace to console and send a 500 response.
app.use(function(req, res) {
   res.status(404).end();
   req.cnn.release();
});

app.use(function(err, req, res, next) {
   res.status(500).json(err.stack);
   req.cnn && req.cnn.release();
});

if (argv[0] === '-p' && !isNaN(Number(argv[1]))) {
   app.listen(Number(argv[1]), function () {
      console.log('App Listening on port ' + argv[1]);
   });
}
else {
   app.listen(4019, function () {
      console.log('App Listening on port 4019');
   });
}
