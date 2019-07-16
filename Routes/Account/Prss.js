var Express = require('express');
var Tags = require('../Validator.js').Tags;
var async = require('async');
var mysql = require('mysql');
var router = Express.Router({caseSensitive: true});

router.baseURL = '/Prss';

router.get('/', function (req,res) {
    var vld = req.validator;
    var query = req.query;
    var admin = req.session && req.session.isAdmin();
    var cnn = req.cnn;
    var email = req.session.isAdmin() && req.query.email ||
     !req.session.isAdmin() && req.session.email;
    var param = req.query.email;

    async.waterfall([
    function(cb) {
       if (!admin) {
          cnn.chkQry('select id, email from Person where email = ?',
           [req.session.email], cb);
       }
       else {
          cnn.chkQry('select id, email from Person', cb);
       }
    },
    function(prsResult, fields, cb) {
       if (prsResult.length !== 0 && param) {
          var obj = [];
          prsResult.forEach(function(cur) {
             if (cur["email"].startsWith(param)) {
                obj.push(cur);
             }
          });
          res.json(obj);
       }
       else {
          res.json(prsResult);
       }
       cb();
    }],
    function(prsArr, err) {
       cnn.release();
    });
});

router.post('/', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var admin = req.session && req.session.isAdmin();
   var cnn = req.cnn;

   if (admin && !body.password)
      body.password = "*";
   body.whenRegistered = (new Date()).getTime();

   async.waterfall([
   function(cb) {
      if (vld.hasFields(body, ["email", "lastName", "password", "role"], cb) &&
       vld.chain(body.role === 0 || admin, Tags.noPermission)
       .chain(body.termsAccepted || admin, Tags.noTerms)
       .check(body.role === 0 || body.role === 1, Tags.badValue,
       ["role"], cb)) {
         cnn.chkQry('select * from Person where email = ?', body.email, cb);
      }
   },
   function(existingPrss, fields, cb) {
      if (vld.check(!existingPrss.length, Tags.dupEmail, null, cb)) {
         body.termsAccepted = body.termsAccepted && (new Date()).getTime();
         if (body.termsAccepted === false) {
            body.termsAccepted = null;
         }
         cnn.chkQry('insert into Person set ?', body, cb);
      }
   },
   function(result, fields, cb) {
      res.location(router.baseURL + '/' + result.insertId).end();
      cb();
   }],
   function(err) {
      cnn.release();
   });
});

router.put('/:id', function(req, res) {
   var vld = req.validator;
   var body = req.body;
   var admin = req.session && req.session.isAdmin();
   var cnn = req.cnn;

   async.waterfall([
      function(cb) {
         if (vld.checkPrsOK(req.params.id, cb) &&
          vld.chain(!('termsAccepted' in body), Tags.forbiddenField,
          ['termsAccepted'])
          .chain(!('whenRegistered' in body), Tags.forbiddenField,
          ['whenRegistered'])
          .chain(!('email' in body), Tags.forbiddenField,['email'])
          .check(!('role' in body) || (body.role === 0) ||
          (admin &&  body.role === 1), Tags.badValue, ['role'], cb))
            cnn.chkQry('select * from Person where id = ?',
             [req.params.id], cb);
      },
      function(result, fields, cb) {
         if (vld.check(result.length, Tags.notFound, null, cb) &&
          vld.check(body.password !== "" && body.password !== null,
          Tags.badValue,["password"], cb) &&
          vld.check(!('password' in body) || admin || (('password' in body) &&
          ('oldPassword' in body))
          || admin, Tags.noOldPwd,null, cb) &&
          vld.check(!('password' in body) || (('oldPassword' in body)
          && body.oldPassword === result[0].password)
          || admin, Tags.oldPwdMismatch, null, cb)) {
            delete body.oldPassword;
            if (!(vld.isEmpty(body))) {
               cnn.chkQry("update Person set ? where id = ?",
                [body, req.params.id], cb);
            }
            else {
               res.status(200).end();
               cnn.release();
            }
         }
      },
      function(result, field, cb) {
         res.status(200).end();
         cb();
      }
   ],
   function(err) {
       cnn.release();
   });
});

router.get('/:id', function(req, res) {
   var vld = req.validator;
   
   async.waterfall([
   function(cb) {
     if (vld.checkPrsOK(req.params.id, cb))
        req.cnn.chkQry('select id, email, firstName, lastName, role,\
         termsAccepted, whenRegistered\
         from Person where id = ?', [req.params.id],
         cb);
   },
   function(prsArr, fields, cb) {
      if (vld.check(prsArr.length, Tags.notFound, null, cb)) {
         res.json(prsArr);
         cb();
      }
   }],
   function(err) {
      req.cnn.release();
   });
});


router.delete('/:id', function(req, res) {
   var vld = req.validator;

   if (vld.checkAdmin())
      req.cnn.chkQry('DELETE from Person where id = ?', [req.params.id],
      function (result, field, cb) {
         if (vld.check(field.affectedRows, Tags.notFound, null, cb)) {
            res.status(200).end();
         }
         req.cnn.release();
      });
   else {
      req.cnn.release();
   }
});

module.exports = router;
