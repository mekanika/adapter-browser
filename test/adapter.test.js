

/**
 * Dependencies
 */

var expect = require('chai').expect
  , query = require('mekanika-query')
  , browser = require('../index.js');



/**
 * Stubs
 */

var localforage = {
  _db: {},
  getItem: function (key, cb) {
    cb( localforage._db[ key ] );
  },
  setItem: function (key, value, cb) {
    localforage._db[ key ] = value;
    cb( value );
  }
};

browser.inject( 'localforage', localforage );



describe('create', function () {

  it('creates a new record', function (done) {

    var qo = query().from('users').create({name:'joe', power:15});
    browser.exec( qo, function ( err, res ) {
      expect( err ).to.equal( null );
      expect( res[0] ).to.include.keys( 'name', 'power' );
      done();
    });
  });

  it('generates a unique id on newly created records', function () {
    var qo = query().from('users').create({name:'joe', power:15});
    browser.exec( qo, function (err, res) {
      expect( res[0] )
    });
  });

});

describe('find', function () {

  it('finds records', function (done) {

    var q = query().from('users').find().where('name', 'joe');
    browser.exec( q, function (err, res) {
      expect( err ).to.equal( null );
      expect( res ).to.have.length[ 1 ];
      expect( res[0].name ).to.equal( 'joe' );
      done();
    });

  });

});


describe('update', function () {

  it('updates a record', function (done) {
    var q = query().from('users').set('power', 200).where('name', 'joe');
    browser.exec( q, function (err, res) {
      expect( res[0].power ).to.equal( 200 );

      var nq = query().from('users').find().where('name', 'joe');
      browser.exec( nq, function (err, res) {
        done();
      });
    });
  });

});


describe('remove', function () {

  it('removes a record from the datastore', function (done) {

    var q = query().from('users').remove().where('name', 'joe');

    browser.exec( q, function (err, res) {

      var nq = query().from('users').find().where('name', 'joe');
      browser.exec( nq, function (err, res) {
        expect( res ).to.have.length( 0 );
        done();
      });
    });

  });

});
