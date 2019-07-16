var Express = require('express');
var Tags = require('../Validator.js').Tags;
var router = Express.Router({caseSensitive: true});
var async = require('async');

router.baseURL = '/Cnvs';

router.get('/', function(req, res) {
   var owner = req.query.owner;
   if (owner) {
      req.cnn.chkQry('select * from Conversation where ownerId = ?',
       [req.query.owner],
      function(err, cnvs) {
         if (!err)
            res.json(cnvs);
         req.cnn.release();
      });
   }
   else {
      req.cnn.chkQry('select * from Conversation ', null,
      function(err, cnvs) {
         if (!err)
            res.json(cnvs);
         req.cnn.release();
      });
   }
});

router.get('/:cnvId', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   body.ownerId = req.session.id;
   async.waterfall([
   function(cb) {
      cnn.chkQry('select id, title, ownerId, lastMessage from Conversation \
       where id = ?', [req.params.cnvId], cb);
   },
   function(result, fields, cb) {
      if (vld.check(result.length, Tags.notFound, null, cb)) {
         res.json(result[0]);
         cb();
      }
   }],
   function() {
      cnn.release();
   });
});

router.post('/', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   body.ownerId = req.session.id;

   async.waterfall([
      //vld.check(('title' in body), Tags.missingField, ["title"], cb)
   function(cb) {
      if (vld.hasFields(body,["title"],cb) &&
       vld.check(body.title.length > 1 && body.title.length <= 80,
       Tags.badValue, ["title"], cb))
         cnn.chkQry('select * from Conversation where title = ?',
          body.title, cb);
   },
   function(existingCnv, fields, cb) {
      if (vld.check(!existingCnv.length, Tags.dupTitle, null, cb))
         cnn.chkQry("insert into Conversation set ?", body, cb);
   },
   function(insRes, fields, cb) {
      res.location(router.baseURL + '/' + insRes.insertId).end();
      cb();
   }],
   function() {
      cnn.release();
   });
});

router.put('/:cnvId', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var cnn = req.cnn;
   var cnvId = req.params.cnvId;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.hasFields(body,["title"],cb) &&
       vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(cnvs[0].ownerId, cb)) {
         if (cnvs[0].title === body.title) {
            res.status(200).end();
            req.cnn.release();
         }
         else {
            cnn.chkQry('select * from Conversation where title = ?',
            [body.title], cb);
         }
      }
   },
   function(sameTtl, fields, cb) {
      if (vld.check(!sameTtl.length , Tags.dupTitle, null,cb) &&
       vld.check(body.title.length <= 80, Tags.badValue, ["title"], cb))
         cnn.chkQry("update Conversation set title = ? where id = ? ",
          [body.title, cnvId], cb);
   }],
   function(err) {
      if (!err)
         res.status(200).end();
      req.cnn.release();
   });
});

router.delete('/:cnvId', function(req, res) {
   var vld = req.validator;
   var cnvId = req.params.cnvId;
   var cnn = req.cnn;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.checkPrsOK(cnvs[0].ownerId, cb))
         cnn.chkQry('delete from Conversation where id = ?', [cnvId], cb);
   }],
   function(err) {
      if (!err)
         res.status(200).end();
      cnn.release();
   });
});

router.get('/:cnvId/Msgs', function(req, res) {
   var vld = req.validator;
   var cnvId = req.params.cnvId;
   var cnn = req.cnn;
   var query = 'select m.id, whenMade, email, content from Conversation c' +
    ' join Message m on cnvId = c.id\
    join Person p on prsId = p.id where c.id = ? ';
   var params = [cnvId];
   var dateTime = req.query.dateTime;
   var num = req.query.num;

   console.log(dateTime);
   if (dateTime) {
      query += 'and whenMade <= ? ';
      if (Number(dateTime)) {
         console.log("yes");
         params.push(Number(dateTime));
      }
      else {
         console.log("not");
         params.push(0);
      }
   }

   query += ' order by whenMade, id';
   if (num) {
      query += ' limit ?';
      params.push(Number(num));
   }
   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(cnvs.length, Tags.notFound, null, cb)) {
         cnn.chkQry(query, params, cb);
      }
   },
   function(msgs, fields, cb) {
      res.json(msgs);
      cb();
   }],
   function(err) {
      cnn.release();
   });
});

router.post('/:cnvId/Msgs', function(req, res) {
   var vld = req.validator;
   var cnn = req.cnn;
   var cnvId = req.params.cnvId;
   var now;
   var body = req.body;

   async.waterfall([
   function(cb) {
      cnn.chkQry('select * from Conversation where id = ?', [cnvId], cb);
   },
   function(cnvs, fields, cb) {
      if (vld.check(('content' in body) && body.content, Tags.missingField,
       ["content"], cb) &&
       vld.check(cnvs.length, Tags.notFound, null, cb) &&
       vld.check(body.content.length <= 5000, Tags.badValue, ["content"], cb))
         cnn.chkQry('insert into Message set ?',
          {cnvId: cnvId, prsId: req.session.id,
          whenMade: now = (new Date()).getTime(), content: body.content}, cb);
   },
   function(insRes, fields, cb) {
      res.location(router.baseURL + '/' + insRes.insertId).end();
      cnn.chkQry("update Conversation set lastMessage = ? where id = ?",
       [now, cnvId], cb);
   },
   function(result, fields, cb) {
      cb();
   }],
   function(err) {
      cnn.release();
   });
});

module.exports = router;
