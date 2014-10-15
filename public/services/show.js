/**
 * Created by Doron Sinai on 15/10/2014.
 */
angular.module('MyApp')
    .factory('Show', ['$resource', function($resource) {
        return $resource('/api/shows/:_id');
    }]);