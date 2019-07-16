var Express = require('express');
var Tags = require('../Validator.js').Tags;
var ssnUtil = require('../Session.js');
var router = Express.Router({caseSensitive: true});

router.baseURL = '/Ssns';

router.get('/', function(req, res) {
   var body = [], ssn;

   if (req.validator.checkAdmin()) {
      for (var cookie in ssnUtil.sessions) {
         ssn = ssnUtil.sessions[cookie];
         body.push({cookie: cookie, prsId: ssn.id, loginTime: ssn.loginTime});
      }
      res.status(200).json(body);
   }
   req.cnn.release();
});

router.post('/', function(req, res) {
   var cookie;
   var cnn = req.cnn;

   cnn.query('select * from Person where email = ?', [req.body.email],
   function(err, result) {
      if (req.validator.check(result.length && result[0].password ===
       req.body.password, Tags.badLogin)) {
         cookie = ssnUtil.makeSession(result[0], res);
         res.location(router.baseURL + '/' + cookie).status(200).end();
      }
      cnn.release();
   });
});

// DELETE ..../SSns/ff73647f737f7
router.delete('/:cookie', function(req, res) {
   var cookie = req.params.cookie;
   var vld = req.validator;
   var admin = req.session && req.session.isAdmin();

   if (vld.check(ssnUtil.sessions[cookie], Tags.notFound) &&
    vld.check(cookie === req.cookies[ssnUtil.cookieName] ||
    admin, Tags.noPermission)) {
      ssnUtil.deleteSession(req.params.cookie);
      res.status(200).end();
   }
   req.cnn.release();
});

router.get('/:cookie', function(req, res) {
   var cookie = req.params.cookie;
   var vld = req.validator;
   var admin = req.session && req.session.isAdmin();

   if (vld.check(ssnUtil.sessions[cookie], Tags.notFound) &&
    vld.check(cookie === req.cookies[ssnUtil.cookieName] ||
    admin, Tags.noPermission)) {
      res.json({cookie: cookie, prsId: req.session.id,
       loginTime: ssnUtil.sessions[cookie].loginTime});
      res.status(200).end();
   }
   req.cnn.release();
});

module.exports = router;
