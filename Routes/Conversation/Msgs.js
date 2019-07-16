var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');

router.baseURL = '/Msgs';

router.get('/:msgId', function(req, res) {
   var body = [], ssn;
   var vld = req.validator;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
      if (vld.loggedIn(req.session, cb)) {
         cnn.chkQry(
          "select whenMade, email, content " +
          "from Conversation c join Message m on cnvId = c.id join " +
          "Person p on p.id = ownerId " +
          "where m.id = ?", [Number(req.params.msgId)], cb);
      }
   },
   function (result,fields,cb) {
      if (vld.check((result.length !== 0), Tags.notFound, null, cb)) {
         res.status(200).json(result[0]);
         cb();
      }
   }],
   function(err) {
      cnn.release();
   });
});

module.exports = router;
