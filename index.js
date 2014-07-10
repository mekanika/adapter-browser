
/**
 * Dependencies
 */

var adapter = require('mekanika-adapter');


/**
 * Local shortcuts. Assumes presence of `localforage` global
 */

if (typeof localforage === 'undefined') localforage = undefined;
var lf = localforage;


/**
 * Default configuration
 * @type {Object}
 */

var defaultConfig = {
  name        : 'mkastore',
  storeName   : 'mkadb'
};


/**
 * Export adapter
 */

module.exports =
  exports =
  adapter.new('browser', defaultConfig);


/**
 * Setup an injector for internal vars
 */

exports.inject = function (name, value) {
  if (name === 'localforage') lf = value;
  // global[ name ] = value;
};


/**
 * Initialise localforage
 */

(function () {
  if (!lf) return;
  lf.config( exports.config );
  // @temp @todo remove testing wrapper for localStorage
  lf.setDriver('localStorageWrapper');
})();


/**
 * Core adapter execution method
 *
 * @param req query object
 * @param {Function} cb Callback passed `( err, results )`
 */

exports.exec = function ( req, cb ) {

  // Bail out if no global 'localforage' available
  if (!lf) throw new Error('Missing global `localforage`');

  // Check requireds
  if (!req || !req.action || !req.resource) throw new Error('Go fuck yourself');

  return exports[ req.action ]
    ? exports[ req.action ]( req, cb )
    : cb( 'No action defined: '+req.action );

};


/**
 * Returns a list of ids passed explicitly in a Qo query object request
 *
 * @param {Query} req The query object
 *
 * @returns {Array} of ids
 */

function _getIds( req ) {
  var ids = [];

  if (req.identifiers) ids = ids.concat( req.identifiers );

  // Is an idField set? Default: 'id'
  var key = req.idField || 'id';

  // Now pull out any ids provided as `where(id = x)` constraints
  if (req.conditions) {
    for (var i=0; i < req.conditions.length; i++) {
      var cx = req.conditions[i];
      // Operating on the idField, continue to process
      if (cx.field === key) {

        // Supported operators: 'eq', 'in'
        if (cx.operator === 'eq') ids.push( cx.condition );
        if (cx.operator === 'in') ids = ids.concat( cx.condition );

      }
    }
  }

  return ids;
}


/**
 * Returns datastore elements that match an array of `constratints`
 *
 * @param {Array} constraints
 * @param {Array} db Arrayed datastore of elements to test
 *
 * @returns {Array} DB elements matching constraints
 */

function _matchWhere( constraints, db ) {

  var finals = [];

  //
  for (var k=0; k < db.length; k++) {

    // Check whether entry meets conditions
    var el = db[k];

    var _match = true;
    constraints.forEach( function (con) {
      switch (con.operator) {
        case 'eq':
          if (el[con.field] !== con.condition) _match = false;
          break;
        case 'neq':
          if (el[con.field] === con.condition) _match = false;
          break;
        case 'in':
          var _tm = false;
          con.condition.forEach( function(val) {
            if (el[con.field] === val) _tm = true;
          });
          if (!_tm) _match = false;
          break;
        case 'nin':
          con.condition.forEach( function(val) {
            if (el[con.field] === val) _match = false;
          });
          break;
        case 'lt':
          if (el[con.field] >= con.condition) _match = false;
          break;
        case 'lte':
          if (el[con.field] > con.condition) _match = false;
          break;
        case 'gt':
          if (el[con.field] <= con.condition) _match = false;
          break;
        case 'gte':
          if (el[con.field] < con.construct) _match = false;
          break;
      }
    });

    if (_match) finals.push( el );

  }

  return finals;
}


/**
 * Create record or array of records
 */

exports.create = function (req, cb) {

  // Access the required table
  lf.getItem( req.resource, function (table) {

    table || (table = []);

    // @todo Check we're not creating duplicate entries
    // Search on idField/s if provided

    // Add new content to table
    req.content.forEach( function ( model ) {
      // Generate a random unique id on the model
      if (!model.id) model.id = Math.random().toString(36).substr(2);
      table.push( model );
    });

    // Save the collection back down
    lf.setItem( req.resource, table, function (res) {
      // Return all created items or just the one
      cb( null, req.content.length > 1 ? req.content : req.content[0] );
    });

  });

};


/**
 * Returns an array of ids that meet the Qo request constraints
 *
 * Applies constraints to datastore source to return matching elements. Compares
 * the result to any passed identifiers creating a subset of matches if
 * applicable. Returns matching ids as array.
 *
 * Note: This is a very non-performant evaluation.
 *
 * @param {Query} req The query object
 * @param {Array} db The datastore to query against
 *
 * @returns {Array} of ids matching query constraints
 */

function _matchIds (req, db) {

  var key = req.idField || 'id';

  // Have ids been provided
  var ids = _getIds( req );
  var finals = [];

  // Apply any conditions to the search space
  if (req.constraints) {
    var matches = _matchWhere( req.constraints, db );

    if (ids.length) {
      matches.forEach( function (match) {
        ids.forEach( function (id) {
          if (match[ key ] === id) finals.push( id );
        });
      });
    }
    // Otherwise map each match 'idField' (key) to the ids array
    else {
      matches.forEach( function (match) {
        finals.push( match[key] );
      });
    }
  }
  else finals = ids;

  return finals;

}


/**
 * Remove records from the datastore
 */

exports.remove = function (req, cb) {
  // Retrieve the collection
  lf.getItem( req.resource, function (table) {
    if (!table || !table.length) cb( 'No data to delete' );

    // Is an idField set? Default: 'id'
    var key = req.idField || 'id';

    var finals = _matchIds( req, table );

    // Step through and remove all ids
    finals.forEach( function (id) {

      // Recurse through the table data
      for (var j=0; j < table.length; j++) {
        if ( table[j][ key ] === id ) {
          table.splice( j, 1 );
          continue;
        }
        if (j === table.length) throw new Error('id not found to delete');
      }

    });

    // Save the collection back down
    // Return the deleted ids
    lf.setItem( req.resource, table, function (res) {
      cb( null, finals );
    });

  });
};


/**
 * Search datastore for records
 */

exports.find = function (req, cb) {

  lf.getItem( req.resource, function (table) {

    table || (table = []);

    // Return nothing if no data
    if (!table.length) return cb( null, []);

    var key = req.idField || 'id';
    var ids = _getIds( req );

    var found = [];

    if (ids.length) {
      // Step through all ids
      for (var i=0; i < ids.length; i++) {

        // Search the table
        for (var j=0; j < table.length; j++) {
          if (table[j][ key ] === ids[i]) {
            found.push( table[j] );
            continue;
          }
        }
      }

      // Set the search conditions for any "where" params
      table = found;
    }

    // Apply any conditions to the search space
    if (req.constraints) {
      var finals = _matchWhere( req.constraints, table );
      cb( null, finals );
    }

    else cb( null, found );

  });

};


/**
 * Update records
 */

exports.update = function (req, cb) {

  lf.getItem( req.resource, function (table) {

    table || (table = []);

    // Return nothing if no data
    if (!table.length) return cb( null, []);

    // Setup what DATA to change
    var change = {};
    if (req.content.length) {
      // Note: This only supports a SINGLE content change
      // ie. not multiple and different changes per id
      change = req.content[0];
    }
    else if (req.modifiers.length) {
      // Create change manifest based on all modifiers
      req.modifiers.forEach( function (mod) {
        // Note: ONLY support 'set' modifiers
        if (mod.set) change[ mod.set ] = mod.value;
      });
    }
    else cb( 'No changes to apply' );

    var key = req.idField || 'id';
    var ids = _matchIds( req, table );

    // The changed elements to return
    var returns = [];

    ids.forEach( function (id) {

      for (var j=0; j < table.length; j++) {
        // Is this a record to update
        if (table[j][ key ] === id) {
          for (var prop in change) table[ j ][ prop ] = change[ prop ];
          returns.push( table[j] );
        }
      }

    });

    // Save it all back down
    lf.setItem( req.resource, table, function () {
      // Return the single changed element or all changed elements
      cb( null, returns.length === 1 ? returns[0] : returns );
    });


  });

};

